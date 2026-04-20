import { getSupabase } from "@/lib/supabase";
import { normalizeSector } from "@/lib/sector-normalize";
import type { FacturaRow } from "@/types/models";

export type FacturaDbRow = {
  id: string;
  id_factura: string | null;
  num_factura: string | null;
  fecha_factura: string | null;
  monto_factura: number | string | null;
  responsable: string | null;
  tipo_servicio: string | null;
  tipo_factura: string | null;
  nit_factura: string | null;
  razon_social: string | null;
  nombre_bia: boolean | null;
  observacion: string | null;
  adjuntar_factura: string | null;
  url: string | null;
  estado: string | null;
  verificado: boolean | null;
  ciudad: string | null;
  sector: string | null;
  centro_costo: string | null;
  info_centro_costo: string | null;
  fecha_creacion: string | null;
  ops: string | null;
  motivo_rechazo: string | null;
  drive_file_id: string | null;
  entrega_id: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const SELECT_COLUMNS =
  "id, id_factura, num_factura, fecha_factura, monto_factura, responsable, tipo_servicio, tipo_factura, nit_factura, razon_social, nombre_bia, observacion, adjuntar_factura, url, estado, verificado, ciudad, sector, centro_costo, info_centro_costo, fecha_creacion, ops, motivo_rechazo, drive_file_id, entrega_id, created_at";

/** Convierte fila de DB → shape legacy de Sheet (múltiples alias por campo para compat UI). */
export function facturaDbToApi(r: FacturaDbRow): FacturaRow {
  const estadoStr = r.estado ?? "Pendiente";
  const nombreBiaStr = r.nombre_bia ? "TRUE" : r.nombre_bia === false ? "FALSE" : "";
  const verificadoStr = r.verificado === true ? "TRUE" : r.verificado === false ? "FALSE" : estadoStr;
  const imagen = r.adjuntar_factura ?? r.url ?? "";
  const row: Record<string, string | number | undefined> = {
    _rowIndex: 0,
    _id: r.id,
    // IDs
    ID: r.id_factura ?? "",
    ID_Factura: r.id_factura ?? "",
    // Número de factura (col B legado Num_Factura)
    Num_Factura: r.num_factura ?? "",
    NumFactura: r.num_factura ?? "",
    // Fechas
    Fecha: r.fecha_factura ?? "",
    Fecha_Factura: r.fecha_factura ?? "",
    FechaCreacion: r.fecha_creacion ?? "",
    // Monto
    Monto_Factura: r.monto_factura != null ? String(r.monto_factura) : "",
    Valor: r.monto_factura != null ? String(r.monto_factura) : "",
    // Responsable
    Responsable: r.responsable ?? "",
    // Tipo servicio/factura
    Tipo_servicio: r.tipo_servicio ?? "",
    ServicioDeclarado: r.tipo_servicio ?? "",
    Tipo_Factura: r.tipo_factura ?? "",
    TipoFactura: r.tipo_factura ?? "",
    // NIT / proveedor
    Nit_Factura: r.nit_factura ?? "",
    NIT: r.nit_factura ?? "",
    Razon_Social: r.razon_social ?? "",
    Proveedor: r.razon_social ?? "",
    // Nombre BIA
    Nombre_bia: nombreBiaStr,
    ANombreBia: nombreBiaStr,
    // Concepto / observación
    Observacion: r.observacion ?? "",
    Concepto: r.observacion ?? "",
    // Imagen / URL
    Adjuntar_Factura: imagen,
    ImagenURL: imagen,
    URL: r.url ?? imagen,
    DriveFileId: r.drive_file_id ?? "",
    // Estado (mismo valor en Legalizado/Estado/Verificado para compat UI)
    Estado: estadoStr,
    Legalizado: estadoStr,
    Verificado: verificadoStr,
    MotivoRechazo: r.motivo_rechazo ?? "",
    // Ubicación
    Ciudad: r.ciudad ?? "",
    Sector: r.sector ?? "",
    // OPS
    OPS: r.ops ?? "",
    TipoOperacion: r.ops ?? "",
    // Centro de costo
    "Centro de Costo": r.centro_costo ?? "",
    InfoCentroCosto: r.info_centro_costo ?? "",
    // Entrega vinculada
    EntregaID: r.entrega_id ?? "",
  };
  return row as unknown as FacturaRow;
}

export async function loadFacturas(): Promise<FacturaRow[]> {
  const PAGE = 1000;
  const all: FacturaDbRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await getSupabase()
      .from("facturas")
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
    .from("facturas")
    .select(SELECT_COLUMNS)
    .eq("id_factura", idFactura)
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
    id_factura: f.idFactura,
    num_factura: f.numFactura || null,
    fecha_factura: parseFechaISO(f.fecha),
    monto_factura: f.valor,
    responsable: f.responsable,
    tipo_servicio: f.servicioDeclarado || null,
    tipo_factura: f.tipoFactura || null,
    nit_factura: f.nit || null,
    razon_social: f.proveedor || null,
    nombre_bia: f.aNombreBia ?? null,
    observacion: f.observacion ?? f.concepto ?? null,
    adjuntar_factura: f.imagenUrl || null,
    url: f.imagenUrl || null,
    estado,
    verificado: estado === "Aprobada" || estado === "Completada",
    ciudad: f.ciudad || null,
    sector: sectorCanon,
    ops: f.tipoOperacion || null,
    drive_file_id: f.driveFileId || null,
    fecha_creacion: f.fechaCreacion || new Date().toISOString(),
  };
  const { error } = await getSupabase().from("facturas").insert(payload);
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
  if (u.fecha !== undefined) patch.fecha_factura = parseFechaISO(String(u.fecha));
  if (u.proveedor !== undefined) patch.razon_social = u.proveedor.trim() || null;
  if (u.nit !== undefined) patch.nit_factura = u.nit.trim() || null;
  if (u.numFactura !== undefined) patch.num_factura = u.numFactura.trim() || null;
  if (u.concepto !== undefined) patch.observacion = u.concepto.trim() || null;
  if (u.valor !== undefined) {
    const raw = String(u.valor).replace(/[^\d.-]/g, "");
    patch.monto_factura = raw ? Number(raw) : null;
  }
  if (u.tipoFactura !== undefined) patch.tipo_factura = u.tipoFactura.trim() || null;
  if (u.servicioDeclarado !== undefined)
    patch.tipo_servicio = u.servicioDeclarado.trim() || null;
  if (u.tipoOperacion !== undefined) patch.ops = u.tipoOperacion.trim() || null;
  if (u.aNombreBia !== undefined) patch.nombre_bia = u.aNombreBia;
  if (u.ciudad !== undefined) patch.ciudad = u.ciudad.trim() || null;
  if (u.sector !== undefined) patch.sector = normalizeSector(u.sector) || u.sector.trim() || null;
  if (u.imagenUrl !== undefined) {
    const v = u.imagenUrl.trim() || null;
    patch.adjuntar_factura = v;
    patch.url = v;
  }
  if (u.driveFileId !== undefined) patch.drive_file_id = u.driveFileId.trim() || null;

  const { error } = await getSupabase()
    .from("facturas")
    .update(patch)
    .eq("id_factura", idFactura);
  if (error) throw error;
}

export async function updateFacturaEstado(
  idFactura: string,
  estado: string,
  motivoRechazo?: string
): Promise<void> {
  const patch: Record<string, unknown> = {
    estado,
    verificado: estado === "Aprobada" || estado === "Completada",
    motivo_rechazo: estado === "Rechazada" ? motivoRechazo || null : null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await getSupabase()
    .from("facturas")
    .update(patch)
    .eq("id_factura", idFactura);
  if (error) throw error;
}

export async function deleteFactura(idFactura: string): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from("facturas")
    .delete()
    .eq("id_factura", idFactura)
    .select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export async function marcarFacturasCompletadas(idsFactura: string[]): Promise<void> {
  if (idsFactura.length === 0) return;
  const { error } = await getSupabase()
    .from("facturas")
    .update({
      estado: "Completada",
      verificado: true,
      updated_at: new Date().toISOString(),
    })
    .in("id_factura", idsFactura);
  if (error) throw error;
}
