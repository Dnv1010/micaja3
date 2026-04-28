import { getSupabase } from "@/lib/supabase";
import { normalizeSector } from "@/lib/sector-normalize";
import { TABLES } from "@/lib/db-tables";

export type LegalizacionDbRow = {
  id: string;
  id_reporte: string | null;
  fecha: string | null;
  fecha_creacion: string | null;
  coordinador: string | null;
  sector: string | null;
  total: number | string | null;
  total_aprobado: number | string | null;
  estado: string | null;
  observacion: string | null;
  url_reporte: string | null;
  periodo_desde: string | null;
  periodo_hasta: string | null;
  facturas_ids: string | null;
  firma_coordinador: string | null;
  firma_admin: string | null;
  resumen_ia: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const SELECT_COLUMNS =
  "id, id_reporte, fecha, fecha_creacion, coordinador, sector, total, total_aprobado, estado, observacion, url_reporte, periodo_desde, periodo_hasta, facturas_ids, firma_coordinador, firma_admin, resumen_ia, created_at";

/** Convierte DB → forma que espera la UI (claves Sheet-style). */
export function legalizacionDbToApi(r: LegalizacionDbRow): Record<string, string> {
  return {
    ID_Reporte: r.id_reporte ?? "",
    ID: r.id_reporte ?? "",
    Fecha_Creacion: r.fecha_creacion ?? r.fecha ?? "",
    Coordinador: r.coordinador ?? "",
    Sector: r.sector ?? "",
    Periodo_Desde: r.periodo_desde ?? "",
    Periodo: r.periodo_desde ?? "",
    Periodo_Hasta: r.periodo_hasta ?? "",
    Total: r.total != null ? String(r.total) : "0",
    TotalAprobado: r.total_aprobado != null ? String(r.total_aprobado) : "",
    Estado: r.estado ?? "",
    Facturas_IDs: r.facturas_ids ?? "",
    FacturasIds: r.facturas_ids ?? "",
    Firma_Coordinador: r.firma_coordinador ?? "",
    Firma_Admin: r.firma_admin ?? "",
    PDF_URL: r.url_reporte ?? "",
    PdfURL: r.url_reporte ?? "",
    Fecha_ISO: r.created_at ?? "",
    Resumen_IA: r.resumen_ia ?? "",
    ResumenIA: r.resumen_ia ?? "",
    Observacion: r.observacion ?? "",
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
    id_reporte: f.idReporte,
    fecha: new Date().toISOString().slice(0, 10),
    fecha_creacion: new Date().toISOString(),
    coordinador: f.coordinador,
    sector: sectorCanon,
    periodo_desde: parseFechaISO(f.periodoDe),
    periodo_hasta: parseFechaISO(f.periodoHasta),
    total: f.total,
    estado: "Pendiente Admin",
    facturas_ids: f.facturasIds,
    firma_coordinador: f.firmaCoordinador,
    url_reporte: f.pdfUrl || null,
    resumen_ia: f.resumenIA || null,
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
    .eq("id_reporte", idReporte)
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
    .update({ estado, updated_at: new Date().toISOString() })
    .eq("id_reporte", idReporte)
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
      firma_admin: firmaAdmin,
      url_reporte: pdfUrl,
      estado: "Firmado",
      updated_at: new Date().toISOString(),
    })
    .eq("id_reporte", idReporte)
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

export async function deleteLegalizacion(idReporte: string): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from(TABLES.expenseReports)
    .delete()
    .eq("id_reporte", idReporte)
    .select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}
