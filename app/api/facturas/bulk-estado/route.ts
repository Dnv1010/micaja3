import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getSupabase } from "@/lib/supabase";
import { responsablesEnZonaSheetSet } from "@/lib/usuarios-sheet";
import { TABLES } from "@/lib/db-tables";
import { updateFacturasEstadoMasivo } from "@/lib/facturas-supabase";
import { appPublicBaseUrl, escHtml, notificarUsuario } from "@/lib/notificaciones";

type BulkRow = {
  invoice_id: string | null;
  status: string | null;
  assignee: string | null;
  company_name: string | null;
};

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const rol = String(session.user.rol || "user").toLowerCase();
  if (rol !== "admin" && rol !== "coordinador") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const idsRaw = Array.isArray(body.ids) ? body.ids : [];
  const ids = idsRaw
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter((x): x is string => !!x);
  const estado = typeof body.estado === "string" ? body.estado.trim() : "";
  const motivoRechazo = String(body.motivoRechazo || "").trim();

  if (ids.length === 0) {
    return NextResponse.json({ error: "Lista de ids vacía" }, { status: 400 });
  }
  if (estado !== "Aprobada" && estado !== "Rechazada") {
    return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
  }
  if (estado === "Rechazada" && !motivoRechazo) {
    return NextResponse.json(
      { error: "Motivo de rechazo obligatorio" },
      { status: 400 }
    );
  }

  const { data: rows, error } = await getSupabase()
    .from(TABLES.invoices)
    .select("invoice_id, status, assignee, company_name")
    .in("invoice_id", ids);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const found = (rows ?? []) as BulkRow[];

  // Filtrar: las Completadas no se pueden tocar
  const elegibles = found.filter(
    (r) => String(r.status || "").toLowerCase() !== "completada"
  );
  const saltadasCompletada = found.length - elegibles.length;

  // Coordinador: solo las de su zona
  let permitidas = elegibles;
  if (rol === "coordinador") {
    const sector = String(session.user.sector || "");
    const set = await responsablesEnZonaSheetSet(sector);
    permitidas = elegibles.filter((r) =>
      set.has(String(r.assignee || "").toLowerCase())
    );
  }
  const saltadasPermisos = elegibles.length - permitidas.length;

  const idsFinal = permitidas
    .map((r) => r.invoice_id)
    .filter((x): x is string => !!x);

  if (idsFinal.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        actualizadas: 0,
        saltadas_completada: saltadasCompletada,
        saltadas_permisos: saltadasPermisos,
        error: "Ninguna factura seleccionada se puede modificar",
      },
      { status: 400 }
    );
  }

  await updateFacturasEstadoMasivo(
    idsFinal,
    estado as "Aprobada" | "Rechazada",
    motivoRechazo || undefined
  );

  if (estado === "Rechazada") {
    const base = appPublicBaseUrl();
    for (const r of permitidas) {
      const msg = [
        `⚠️ <b>BIA Energy - MiCaja</b>`,
        ``,
        `Tu factura de <b>${escHtml(r.company_name || "—")}</b> fue rechazada.`,
        ``,
        `<b>Motivo:</b> ${escHtml(motivoRechazo)}`,
        ``,
        `Corrígela en: ${escHtml(`${base}/facturas`)}`,
      ].join("\n");
      void notificarUsuario(r.assignee || "", msg).catch(() => {});
    }
  }

  return NextResponse.json({
    ok: true,
    actualizadas: idsFinal.length,
    saltadas_completada: saltadasCompletada,
    saltadas_permisos: saltadasPermisos,
  });
}
