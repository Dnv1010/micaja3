import { getSupabase } from "@/lib/supabase";
import { normalizeSector } from "@/lib/sector-normalize";
import type { FacturaRow } from "@/types/models";
import { TABLES } from "@/lib/db-tables";

export type FacturaDbRow = {
  id: string;
  invoice_id: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  invoice_amount: number | string | null;
  assignee: string | null;
  service_type: string | null;
  invoice_type: string | null;
  vendor_tax_id: string | null;
  company_name: string | null;
  billed_to_bia: boolean | null;
  notes: string | null;
  attachment_url: string | null;
  url: string | null;
  status: string | null;
  verificado: boolean | null;
  city: string | null;
  region: string | null;
  cost_center: string | null;
  cost_center_info: string | null;
  submitted_at: string | null;
  ops: string | null;
  rejection_reason: string | null;
  drive_file_id: string | null;
  transfer_id: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const SELECT_COLUMNS =
  "id, invoice_id, invoice_number, invoice_date, invoice_amount, assignee, service_type, invoice_type, vendor_tax_id, company_name, billed_to_bia, notes, attachment_url, url, status, verificado, city, region, cost_center, cost_center_info, submitted_at, ops, rejection_reason, drive_file_id, transfer_id, created_at";

/** Convierte fila de DB → shape legacy de Sheet (múltiples alias por campo para compat UI). */
export function facturaDbToApi(r: FacturaDbRow): FacturaRow {
  const estadoStr = r.status ?? "Pendiente";
  const nombreBiaStr = r.billed_to_bia ? "TRUE" : r.billed_to_bia === false ? "FALSE" : "";
  const verificadoStr = r.verificado === true ? "TRUE" : r.verificado === false ? "FALSE" : estadoStr;
  const imagen = r.attachment_url ?? r.url ?? "";
  const row: Record<string, string | number | undefined> = {
    _rowIndex: 0,
    _id: r.id,
    // IDs
    ID: r.invoice_id ?? "",
    ID_Factura: r.invoice_id ?? "",
    // Número de factura (col B legado Num_Factura)
    Num_Factura: r.invoice_number ?? "",
    NumFactura: r.invoice_number ?? "",
    // Fechas
    Fecha: r.invoice_date ?? "",
    Fecha_Factura: r.invoice_date ?? "",
    FechaCreacion: r.submitted_at ?? "",
    // Monto
    Monto_Factura: r.invoice_amount != null ? String(r.invoice_amount) : "",
    Valor: r.invoice_amount != null ? String(r.invoice_amount) : "",
    // Responsable
    Responsable: r.assignee ?? "",
    // Tipo servicio/factura
    Tipo_servicio: r.service_type ?? "",
    ServicioDeclarado: r.service_type ?? "",
    Tipo_Factura: r.invoice_type ?? "",
    TipoFactura: r.invoice_type ?? "",
    // NIT / proveedor
    Nit_Factura: r.vendor_tax_id ?? "",
    NIT: r.vendor_tax_id ?? "",
    Razon_Social: r.company_name ?? "",
    Proveedor: r.company_name ?? "",
    // Nombre BIA
    Nombre_bia: nombreBiaStr,
    ANombreBia: nombreBiaStr,
    // Concepto / observación
    Observacion: r.notes ?? "",
    Concepto: r.notes ?? "",
    // Imagen / URL
    Adjuntar_Factura: imagen,
    ImagenURL: imagen,
    URL: r.url ?? imagen,
    DriveFileId: r.drive_file_id ?? "",
    // Estado (mismo valor en Legalizado/Estado/Verificado para compat UI)
    Estado: estadoStr,
    Legalizado: estadoStr,
    Verificado: verificadoStr,
    MotivoRechazo: r.rejection_reason ?? "",
    // Ubicación
    Ciudad: r.city ?? "",
    Sector: r.region ?? "",
    // OPS
    OPS: r.ops ?? "",
    TipoOperacion: r.ops ?? "",
    // Centro de costo
    "Centro de Costo": r.cost_center ?? "",
    InfoCentroCosto: r.cost_center_info ?? "",
    // Entrega vinculada
    EntregaID: r.transfer_id ?? "",
  };
  return row as unknown as FacturaRow;
}

export async function loadFacturas(): Promise<FacturaRow[]> {
  const PAGE = 1000;
  const all: FacturaDbRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await getSupabase()
      .from(TABLES.invoices)
      .select(SELECT_COLUMNS)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const batch = (data ?? []) as FacturaDbRow[];
    all.push(...batch);
    if (batch.length < PAGE) break;
  }
  return all.map(facturaDbToApi);
}

export async function findFacturaById(idFactura: string): Promise<FacturaRow | null> {
  const { data, error } = await getSupabase()
    .from(TABLES.invoices)
    .select(SELECT_COLUMNS)
    .eq("invoice_id", idFactura)
    .limit(1);
  if (error) throw error;
  if (!data || data.length === 0) return null;
  return facturaDbToApi(data[0] as FacturaDbRow);
}

export type FacturaInsertFields = {
  idFactura: string;
  fecha: string;
  responsable: string;
  sector?: string;
  ciudad?: string;
  proveedor?: string;
  nit?: string;
  numFactura?: string;
  concepto?: string;
  observacion?: string;
  valor: number;
  tipoFactura?: string;
  servicioDeclarado?: string;
  tipoOperacion?: string;
  aNombreBia?: boolean;
  estado?: string;
  imagenUrl?: string;
  driveFileId?: string;
  fechaCreacion?: string;
};

function parseFechaISO(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const dmY = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmY) {
    return `${dmY[3]}-${dmY[2].padStart(2, "0")}-${dmY[1].padStart(2, "0")}`;
  }
  const d = new Date(t);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

export async function insertFactura(f: FacturaInsertFields): Promise<void> {
  const estado = (f.estado || "Pendiente").trim();
  const sectorCanon = normalizeSector(f.sector ?? "") || "Bogota";
  const payload: Record<string, unknown> = {
    invoice_id: f.idFactura,
    invoice_number: f.numFactura || null,
    invoice_date: parseFechaISO(f.fecha),
    invoice_amount: f.valor,
    assignee: f.responsable,
    service_type: f.servicioDeclarado || null,
    invoice_type: f.tipoFactura || null,
    vendor_tax_id: f.nit || null,
    company_name: f.proveedor || null,
    billed_to_bia: f.aNombreBia ?? null,
    notes: f.observacion ?? f.concepto ?? null,
    attachment_url: f.imagenUrl || null,
    url: f.imagenUrl || null,
    status: estado,
    verificado: estado === "Aprobada" || estado === "Completada",
    city: f.ciudad || null,
    region: sectorCanon,
    ops: f.tipoOperacion || null,
    drive_file_id: f.driveFileId || null,
    submitted_at: f.fechaCreacion || new Date().toISOString(),
  };
  const { error } = await getSupabase().from(TABLES.invoices).insert(payload);
  if (error) throw error;
}

export type FacturaUpdateFields = {
  fecha?: string;
  proveedor?: string;
  nit?: string;
  numFactura?: string;
  concepto?: string;
  valor?: string | number;
  tipoFactura?: string;
  servicioDeclarado?: string;
  tipoOperacion?: string;
  aNombreBia?: boolean;
  ciudad?: string;
  sector?: string;
  imagenUrl?: string;
  driveFileId?: string;
};

export async function updateFactura(
  idFactura: string,
  u: FacturaUpdateFields
): Promise<void> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (u.fecha !== undefined) patch.invoice_date = parseFechaISO(String(u.fecha));
  if (u.proveedor !== undefined) patch.company_name = u.proveedor.trim() || null;
  if (u.nit !== undefined) patch.vendor_tax_id = u.nit.trim() || null;
  if (u.numFactura !== undefined) patch.invoice_number = u.numFactura.trim() || null;
  if (u.concepto !== undefined) patch.notes = u.concepto.trim() || null;
  if (u.valor !== undefined) {
    const raw = String(u.valor).replace(/[^\d.-]/g, "");
    patch.invoice_amount = raw ? Number(raw) : null;
  }
  if (u.tipoFactura !== undefined) patch.invoice_type = u.tipoFactura.trim() || null;
  if (u.servicioDeclarado !== undefined)
    patch.service_type = u.servicioDeclarado.trim() || null;
  if (u.tipoOperacion !== undefined) patch.ops = u.tipoOperacion.trim() || null;
  if (u.aNombreBia !== undefined) patch.billed_to_bia = u.aNombreBia;
  if (u.ciudad !== undefined) patch.city = u.ciudad.trim() || null;
  if (u.sector !== undefined) patch.region = normalizeSector(u.sector) || u.sector.trim() || null;
  if (u.imagenUrl !== undefined) {
    const v = u.imagenUrl.trim() || null;
    patch.attachment_url = v;
    patch.url = v;
  }
  if (u.driveFileId !== undefined) patch.drive_file_id = u.driveFileId.trim() || null;

  const { error } = await getSupabase()
    .from(TABLES.invoices)
    .update(patch)
    .eq("invoice_id", idFactura);
  if (error) throw error;
}

export async function updateFacturaEstado(
  idFactura: string,
  estado: string,
  motivoRechazo?: string
): Promise<void> {
  const patch: Record<string, unknown> = {
    status: estado,
    verificado: estado === "Aprobada" || estado === "Completada",
    rejection_reason: estado === "Rechazada" ? motivoRechazo || null : null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await getSupabase()
    .from(TABLES.invoices)
    .update(patch)
    .eq("invoice_id", idFactura);
  if (error) throw error;
}

export async function deleteFactura(idFactura: string): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from(TABLES.invoices)
    .delete()
    .eq("invoice_id", idFactura)
    .select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export async function updateFacturasEstadoMasivo(
  idsFactura: string[],
  estado: "Aprobada" | "Rechazada",
  motivoRechazo?: string
): Promise<void> {
  if (idsFactura.length === 0) return;
  const patch: Record<string, unknown> = {
    status: estado,
    verificado: estado === "Aprobada",
    rejection_reason: estado === "Rechazada" ? motivoRechazo || null : null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await getSupabase()
    .from(TABLES.invoices)
    .update(patch)
    .in("invoice_id", idsFactura);
  if (error) throw error;
}

export async function marcarFacturasCompletadas(idsFactura: string[]): Promise<void> {
  if (idsFactura.length === 0) return;
  const { error } = await getSupabase()
    .from(TABLES.invoices)
    .update({
      status: "Completada",
      verificado: true,
      updated_at: new Date().toISOString(),
    })
    .in("invoice_id", idsFactura);
  if (error) throw error;
}
