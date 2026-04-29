import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { parseCOPString } from "@/lib/format";
import { appPublicBaseUrl } from "@/lib/notificaciones";
import { findLegalizacionByReporteId } from "@/lib/legalizaciones-supabase";
import { Resend } from "resend";

function escAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const rol = String(session.user.rol || "").toLowerCase();
  if (rol !== "coordinador" && rol !== "admin") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "RESEND_API_KEY no configurada" }, { status: 503 });
  }

  let body: { reporteId?: string; pdfUrl?: string; pdfBase64?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const reporteId = String(body.reporteId || "").trim();
  if (!reporteId) {
    return NextResponse.json({ error: "Falta reporteId" }, { status: 400 });
  }

  try {
    const row = await findLegalizacionByReporteId(reporteId);
    if (!row) {
      return NextResponse.json({ error: "Reporte no encontrado" }, { status: 404 });
    }

    const coordinadorRow = (row.coordinator ?? "").trim();
    const sessionCoord = String(session.user.responsable || session.user.name || "").trim();
    if (rol === "coordinador" && coordinadorRow.toLowerCase() !== sessionCoord.toLowerCase()) {
      return NextResponse.json(
        { error: "No puedes enviar reportes de otro coordinador" },
        { status: 403 }
      );
    }

    const estado = (row.status ?? "").toLowerCase();
    if (!estado.includes("firmado")) {
      return NextResponse.json({ error: "El reporte aún no está firmado" }, { status: 400 });
    }

    const coordinador = coordinadorRow || sessionCoord;
    const sector = (row.region ?? "").trim();
    const periodoDe = row.period_start ?? "";
    const periodoHasta = row.period_end ?? "";
    const totalRaw = row.total != null ? String(row.total) : "0";
    const totalNum =
      parseCOPString(totalRaw) || Number(totalRaw.replace(/[^\d.-]/g, "")) || 0;
    const resumenIA = (row.ai_summary ?? "").trim();

    const facturasRaw = row.invoice_ids ?? "";
    let numFacturas = 0;
    try {
      let parsed: unknown = JSON.parse(facturasRaw);
      if (typeof parsed === "string") parsed = JSON.parse(parsed);
      if (Array.isArray(parsed)) numFacturas = parsed.length;
    } catch {
      numFacturas = 0;
    }

    const totalFormato = `$${Math.round(totalNum).toLocaleString("es-CO")}`;
    const zonaLabel = sector === "Costa Caribe" ? "Costa Caribe" : "Bogotá";

    const pdfUrl = String(body.pdfUrl || row.report_url || "").trim();
    let pdfBase64 = body.pdfBase64?.replace(/^data:application\/pdf;base64,/i, "").trim() || "";

    if (!pdfBase64 && pdfUrl) {
      try {
        const pdfRes = await fetch(pdfUrl, { redirect: "follow" });
        if (pdfRes.ok) {
          const buf = Buffer.from(await pdfRes.arrayBuffer());
          pdfBase64 = buf.toString("base64");
        }
      } catch (e) {
        console.error("[enviar-fx] descarga PDF:", e);
      }
    }

    if (!pdfBase64) {
      return NextResponse.json(
        { error: "No se pudo obtener el PDF (comprueba que el enlace de Drive sea público)" },
        { status: 502 }
      );
    }

    const asunto = `Reporte Caja Menor ${zonaLabel} — ${coordinador} — ${periodoDe} al ${periodoHasta}`;
    const baseUrl = appPublicBaseUrl();

    const cuerpo = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #001035; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="color: #08DDBC; margin: 0;">⚡ BIA Energy SAS ESP</h2>
        <p style="color: #fff; margin: 4px 0 0;">MiCaja — Reporte de Caja Menor</p>
      </div>

      <div style="background: #f8f9fa; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #e0e0e0;">
        <h3 style="color: #001035;">Envío Reporte Caja Menor de ${escAttr(coordinador)} (${escAttr(zonaLabel)})</h3>

        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr>
            <td style="padding: 8px; color: #666;">Coordinador:</td>
            <td style="padding: 8px; font-weight: bold;">${escAttr(coordinador)}</td>
          </tr>
          <tr style="background: #f0f0f0;">
            <td style="padding: 8px; color: #666;">Zona:</td>
            <td style="padding: 8px; font-weight: bold;">${escAttr(zonaLabel)}</td>
          </tr>
          <tr>
            <td style="padding: 8px; color: #666;">Período:</td>
            <td style="padding: 8px;">${escAttr(periodoDe)} al ${escAttr(periodoHasta)}</td>
          </tr>
          <tr style="background: #f0f0f0;">
            <td style="padding: 8px; color: #666;">N° de facturas:</td>
            <td style="padding: 8px;">${numFacturas} facturas</td>
          </tr>
          <tr>
            <td style="padding: 8px; color: #666;">Total a reembolsar:</td>
            <td style="padding: 8px; font-weight: bold; font-size: 18px; color: #001035;">${escAttr(totalFormato)} COP</td>
          </tr>
        </table>

        ${
          resumenIA
            ? `
        <div style="background: #EDE9FC; border-left: 4px solid #534AB7; padding: 12px; border-radius: 4px; margin: 16px 0;">
          <p style="color: #3C3489; font-size: 13px; margin: 0;"><strong>✨ Análisis IA:</strong> ${escAttr(resumenIA)}</p>
        </div>
        `
            : ""
        }

        <p style="color: #666; font-size: 13px; margin-top: 16px;">
          El reporte firmado por el coordinador y el administrador se adjunta en PDF.
        </p>

        <div style="background: #001035; padding: 12px; border-radius: 6px; margin-top: 16px; text-align: center;">
          <a href="${escAttr(`${baseUrl}/admin/reportes`)}"
             style="color: #08DDBC; text-decoration: none; font-size: 14px;">
            Ver en MiCaja →
          </a>
        </div>
      </div>

      <p style="color: #999; font-size: 11px; text-align: center; margin-top: 16px;">
        BIA Energy SAS ESP · NIT 901.588.413-2 · MiCaja Sistema de Caja Menor
      </p>
    </div>
  `;

    const toRaw = process.env.RESEND_FX_TO?.trim() || "dinovi.sanchez@bia.app";
    const toList = toRaw.split(/[,;]/).map((e) => e.trim()).filter(Boolean);

    const from =
      process.env.RESEND_FROM?.trim() || "MiCaja BIA Energy <onboarding@resend.dev>";

    const resend = new Resend(apiKey);

    const attachments = [
      {
        filename: `Reporte_CajaMenor_${coordinador.replace(/\s+/g, "_")}_${periodoDe || "periodo"}.pdf`,
        content: pdfBase64,
      },
    ];

    const sendResult = await resend.emails.send({
      from,
      to: toList,
      subject: asunto,
      html: cuerpo,
      attachments,
    });

    if (sendResult.error) {
      console.error("[enviar-fx]", sendResult.error);
      return NextResponse.json({ error: "Error enviando email" }, { status: 500 });
    }

    void req;
    return NextResponse.json({ ok: true, emailId: sendResult.data?.id });
  } catch (e) {
    console.error("[enviar-fx]", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
