import { getSupabase } from "@/lib/supabase";
import { normalizeSector } from "@/lib/sector-normalize";
import { TABLES } from "@/lib/db-tables";

export type LegalizacionDbRow = {
  id: string;
  report_id: string | null;
  fecha: string | null;
  submitted_at: string | null;
  coordinator: string | null;
  region: string | null;
  total: number | string | null;
  approved_total: number | string | null;
  status: string | null;
  notes: string | null;
  report_url: string | null;
  period_start: string | null;
  period_end: string | null;
  invoice_ids: string | null;
  coordinator_signature: string | null;
  admin_signature: string | null;
  ai_summary: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const SELECT_COLUMNS =
  "id, report_id, fecha, submitted_at, coordinator, region, total, approved_total, status, notes, report_url, period_start, period_end, invoice_ids, coordinator_signature, admin_signature, ai_summary, created_at";

/** Convierte DB → forma que espera la UI (claves Sheet-style). */
export function legalizacionDbToApi(r: LegalizacionDbRow): Record<string, string> {
  return {
    ID_Reporte: r.report_id ?? "",
    ID: r.report_id ?? "",
    Fecha_Creacion: r.submitted_at ?? r.fecha ?? "",
    Coordinador: r.coordinator ?? "",
    Sector: r.region ?? "",
    Periodo_Desde: r.period_start ?? "",
    Periodo: r.period_start ?? "",
    Periodo_Hasta: r.period_end ?? "",
    Total: r.total != null ? String(r.total) : "0",
    TotalAprobado: r.approved_total != null ? String(r.approved_total) : "",
    Estado: r.status ?? "",
    Facturas_IDs: r.invoice_ids ?? "",
    FacturasIds: r.invoice_ids ?? "",
    Firma_Coordinador: r.coordinator_signature ?? "",
    Firma_Admin: r.admin_signature ?? "",
    PDF_URL: r.report_url ?? "",
    PdfURL: r.report_url ?? "",
    Fecha_ISO: r.created_at ?? "",
    Resumen_IA: r.ai_summary ?? "",
    ResumenIA: r.ai_summary ?? "",
    Observacion: r.notes ?? "",
  };
}

export type LegalizacionInsertFields = {
  idReporte: string;
  coordinador: string;
  sector: string;
  periodoDe: string;
  periodoHasta: string;
  total: number;
  facturasIds: string; // JSON array como string
  firmaCoordinador: string;
  pdfUrl: string;
  resumenIA: string;
};

function parseFechaISO(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const dmY = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmY) return `${dmY[3]}-${dmY[2].padStart(2, "0")}-${dmY[1].padStart(2, "0")}`;
  const d = new Date(t);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

export async function insertLegalizacion(f: LegalizacionInsertFields): Promise<void> {
  const sectorCanon = normalizeSector(f.sector) || "Bogota";
  const payload = {
    report_id: f.idReporte,
    fecha: new Date().toISOString().slice(0, 10),
    submitted_at: new Date().toISOString(),
    coordinator: f.coordinador,
    region: sectorCanon,
    period_start: parseFechaISO(f.periodoDe),
    period_end: parseFechaISO(f.periodoHasta),
    total: f.total,
    status: "Pendiente Admin",
    invoice_ids: f.facturasIds,
    coordinator_signature: f.firmaCoordinador,
    report_url: f.pdfUrl || null,
    ai_summary: f.resumenIA || null,
  };
  const { error } = await getSupabase().from(TABLES.expenseReports).insert(payload);
  if (error) throw error;
}

export async function findLegalizacionByReporteId(
  idReporte: string
): Promise<LegalizacionDbRow | null> {
  const { data, error } = await getSupabase()
    .from(TABLES.expenseReports)
    .select(SELECT_COLUMNS)
    .eq("report_id", idReporte)
    .limit(1);
  if (error) throw error;
  return data && data.length > 0 ? (data[0] as LegalizacionDbRow) : null;
}

export async function loadLegalizaciones(): Promise<LegalizacionDbRow[]> {
  const { data, error } = await getSupabase()
    .from(TABLES.expenseReports)
    .select(SELECT_COLUMNS)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as LegalizacionDbRow[];
}

export async function updateLegalizacionEstado(
  idReporte: string,
  estado: string
): Promise<number> {
  const { data, error } = await getSupabase()
    .from(TABLES.expenseReports)
    .update({ status: estado, updated_at: new Date().toISOString() })
    .eq("report_id", idReporte)
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

export async function firmarLegalizacionAdmin(
  idReporte: string,
  firmaAdmin: string,
  pdfUrl: string
): Promise<number> {
  const { data, error } = await getSupabase()
    .from(TABLES.expenseReports)
    .update({
      admin_signature: firmaAdmin,
      report_url: pdfUrl,
      status: "Firmado",
      updated_at: new Date().toISOString(),
    })
    .eq("report_id", idReporte)
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

export async function deleteLegalizacion(idReporte: string): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from(TABLES.expenseReports)
    .delete()
    .eq("report_id", idReporte)
    .select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}
