export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getSupabase } from "@/lib/supabase";
import { Resend } from "resend";
import { TABLES } from "@/lib/db-tables";

function escAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "RESEND_API_KEY no configurada" }, { status: 503 });
  }

  let body: { email?: string; emails?: string[] };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const destinatarios = Array.isArray(body.emails) && body.emails.length
    ? body.emails
    : body.email
      ? String(body.email).split(/[,;]/)
      : [];
  const toList = destinatarios.map((e) => e.trim()).filter(isValidEmail);
  if (!toList.length) {
    return NextResponse.json({ error: "Debes indicar al menos un email válido" }, { status: 400 });
  }

  try {
    const { data: rows, error } = await getSupabase()
      .from(TABLES.expenseGroups)
      .select("group_id, assignee, job_title, reason, start_date, end_date, amount, pdf_url, region, status")
      .eq("group_id", id)
      .limit(1);
    if (error) throw error;
    const row = rows?.[0];
    if (!row) {
      return NextResponse.json({ error: "Agrupación no encontrada" }, { status: 404 });
    }
    if (!row.pdf_url) {
      return NextResponse.json({ error: "La agrupación no tiene PDF generado" }, { status: 400 });
    }

    const rol = String(session.user.rol || "").toLowerCase();
    const me = String(session.user.responsable || session.user.name || "").trim().toLowerCase();
    if (rol !== "admin" && rol !== "coordinador") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }
    if (rol === "coordinador" && String(row.assignee ?? "").trim().toLowerCase() !== me) {
      return NextResponse.json({ error: "No puedes enviar agrupaciones de otro usuario" }, { status: 403 });
    }

    const pdfRes = await fetch(String(row.pdf_url), { redirect: "follow" });
    if (!pdfRes.ok) {
      return NextResponse.json({ error: "No se pudo descargar el PDF" }, { status: 502 });
    }
    const pdfBase64 = Buffer.from(await pdfRes.arrayBuffer()).toString("base64");

    const responsable = String(row.assignee ?? "").trim();
    const motivo = String(row.reason ?? "").trim();
    const periodoDe = String(row.start_date ?? "");
    const periodoHasta = String(row.end_date ?? "");
    const totalNum = Number(row.amount ?? 0) || 0;
    const totalFormato = `$${Math.round(totalNum).toLocaleString("es-CO")}`;
    const zonaLabel = String(row.region ?? "");

    const asunto = `Reporte Gastos Generales — ${responsable} — ${id}`;
    const cuerpo = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #001035; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="color: #08DDBC; margin: 0;">⚡ BIA Energy SAS ESP</h2>
        <p style="color: #fff; margin: 4px 0 0;">MiCaja — Reporte de Gastos Generales</p>
      </div>
      <div style="background: #f8f9fa; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #e0e0e0;">
        <h3 style="color: #001035;">Agrupación ${escAttr(id)}</h3>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 8px; color: #666;">Responsable:</td><td style="padding: 8px; font-weight: bold;">${escAttr(responsable)}</td></tr>
          <tr style="background: #f0f0f0;"><td style="padding: 8px; color: #666;">Motivo:</td><td style="padding: 8px;">${escAttr(motivo || "—")}</td></tr>
          <tr><td style="padding: 8px; color: #666;">Período:</td><td style="padding: 8px;">${escAttr(periodoDe)} al ${escAttr(periodoHasta)}</td></tr>
          ${zonaLabel ? `<tr style="background: #f0f0f0;"><td style="padding: 8px; color: #666;">Zona:</td><td style="padding: 8px;">${escAttr(zonaLabel)}</td></tr>` : ""}
          <tr><td style="padding: 8px; color: #666;">Total:</td><td style="padding: 8px; font-weight: bold; font-size: 18px; color: #001035;">${escAttr(totalFormato)} COP</td></tr>
        </table>
        <p style="color: #666; font-size: 13px; margin-top: 16px;">El reporte firmado se adjunta en PDF.</p>
      </div>
      <p style="color: #999; font-size: 11px; text-align: center; margin-top: 16px;">
        BIA Energy SAS ESP · NIT 901.588.413-2 · MiCaja
      </p>
    </div>`;

    const from = process.env.RESEND_FROM?.trim() || "MiCaja BIA Energy <onboarding@resend.dev>";

    const resend = new Resend(apiKey);
    const sendResult = await resend.emails.send({
      from,
      to: toList,
      subject: asunto,
      html: cuerpo,
      attachments: [
        {
          filename: `Gastos_${id}.pdf`,
          content: pdfBase64,
        },
      ],
    });

    if (sendResult.error) {
      console.error("[gastos-grupos/enviar-email]", sendResult.error);
      return NextResponse.json({ error: "Error enviando email" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, emailId: sendResult.data?.id, to: toList });
  } catch (e) {
    console.error("[gastos-grupos/enviar-email]", e);
    const msg = e instanceof Error ? e.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
