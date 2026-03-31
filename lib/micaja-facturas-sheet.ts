import {
  getSheetsClient,
  SHEET_NAMES,
  SPREADSHEET_IDS,
} from "@/lib/google-sheets";
import { appendSheetRow, getSheetData, quoteSheetTitleForRange } from "@/lib/sheets-helpers";

/**
 * Encabezados pestaña Facturas (columnas A–S).
 * Col B = Num_Factura (nº proveedor); col I = NumFactura (legacy, vacío en nuevas filas); col S = OPS.
 */
export const MICAJA_FACTURAS_HEADERS_LEGACY_AS = [
  "ID_Factura",
  "Num_Factura",
  "Fecha_Factura",
  "Monto_Factura",
  "Responsable",
  "Tipo_servicio",
  "Tipo_Factura",
  "Nit_Factura",
  "NumFactura",
  "Razon_Social",
  "Nombre_bia",
  "Observacion",
  "Adjuntar_Factura",
  "URL",
  "Legalizado",
  "Verificado",
  "Ciudad",
  "Sector",
  "OPS",
] as const;

/** @deprecated Mantener solo por si algún import externo; usar MICAJA_FACTURAS_HEADERS_LEGACY_AS */
export const MICAJA_FACTURAS_DEFAULT_HEADERS = [...MICAJA_FACTURAS_HEADERS_LEGACY_AS];

export function normalizeFacturaHeader(h: string): string {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/\.+/g, "")
    .replace(/_/g, "");
}

/** Encabezado real de la hoja que coincide con uno de los alias (misma fila 1). */
export function matchSheetHeader(headers: string[], ...aliases: string[]): string | null {
  const want = new Set(aliases.map((a) => normalizeFacturaHeader(a)));
  for (const h of headers) {
    const hk = String(h ?? "").trim();
    if (!hk) continue;
    if (want.has(normalizeFacturaHeader(hk))) return hk;
  }
  return null;
}

export type FacturaSheetWriteFields = {
  id: string;
  fecha: string;
  responsable: string;
  area: string;
  sector: string;
  ciudad: string;
  proveedor: string;
  nit: string;
  numFactura: string;
  concepto: string;
  valor: string;
  tipoFactura: string;
  servicioDeclarado: string;
  tipoOperacion: string;
  aNombreBia: boolean;
  estado: string;
  motivoRechazo: string;
  imagenUrl: string;
  driveFileId: string;
  fechaCreacion: string;
};

function cellForNormalizedHeader(n: string, f: FacturaSheetWriteFields): string {
  if (n === "id" || n === "idfactura") return f.id;
  if (n === "fecha" || n === "fechafactura") return f.fecha;
  if (n === "responsable") return f.responsable;
  if (n === "area") return f.area;
  if (n === "sector") return f.sector;
  if (n === "ciudad") return f.ciudad;
  if (n === "proveedor" || n === "razonsocial") return f.proveedor;
  if (n === "nit" || n === "nitfactura") return f.nit;
  if (n === "numfactura" || n === "numerofactura") return f.numFactura;
  if (n === "concepto" || n === "observacion") return f.concepto;
  if (n === "valor" || n === "montofactura" || n === "monto") return f.valor;
  if (n === "tipofactura") return f.tipoFactura;
  if (n === "serviciodeclarado" || n === "tiposervicio") return f.servicioDeclarado;
  if (n === "tipooperacion" || n === "ops") return f.tipoOperacion;
  if (n === "anombrebia" || n === "nombrebia") {
    return f.aNombreBia ? "TRUE" : "FALSE";
  }
  if (n === "estado") return f.estado;
  if (n === "motivorechazo" || n.includes("motivo")) return f.motivoRechazo;
  if (n === "imagenurl" || n === "adjuntarfactura") return f.imagenUrl;
  if (n === "url") return f.imagenUrl;
  if (n === "drivefileid" || n.includes("drive")) return f.driveFileId;
  if (n === "fechacreacion") return f.fechaCreacion;
  if (n === "legalizado") return f.estado;
  if (n === "verificado") return "Pendiente";
  return "";
}

/** Una celda por columna según el orden real de la fila de encabezados (hojas mixtas). */
export function buildFacturaRowForHeaders(headers: string[], f: FacturaSheetWriteFields): string[] {
  return headers.map((h) => cellForNormalizedHeader(normalizeFacturaHeader(String(h)), f));
}

/** Fila fija A–S alineada con MICAJA_FACTURAS_HEADERS_LEGACY_AS */
export function buildMicajaFacturasLegacyRowAS(params: {
  id: string;
  numFactura: string;
  fecha: string;
  valor: string;
  responsable: string;
  servicioDeclarado: string;
  tipoFactura: string;
  nit: string;
  razonSocial: string;
  aNombreBia: boolean;
  concepto: string;
  imagenUrl: string;
  ciudad: string;
  sector: string;
  tipoOperacion: string;
}): string[] {
  return [
    params.id,
    params.numFactura,
    params.fecha,
    params.valor,
    params.responsable,
    params.servicioDeclarado,
    params.tipoFactura,
    params.nit,
    "",
    params.razonSocial,
    params.aNombreBia ? "TRUE" : "FALSE",
    params.concepto,
    params.imagenUrl,
    params.imagenUrl,
    "Pendiente",
    "Pendiente",
    params.ciudad,
    params.sector,
    params.tipoOperacion,
  ];
}

export type FacturaApiUpdateBody = {
  fecha?: string;
  proveedor?: string;
  nit?: string;
  numFactura?: string;
  concepto?: string;
  valor?: string;
  tipoFactura?: string;
  servicioDeclarado?: string;
  tipoOperacion?: string;
  aNombreBia?: boolean;
  ciudad?: string;
  sector?: string;
  imagenUrl?: string;
  driveFileId?: string;
};

/** PATCH/PUT: mapa clave exacta de hoja → valor. */
export function mapFacturaUpdateBodyToSheetPatch(
  headers: string[],
  body: FacturaApiUpdateBody
): Record<string, string> {
  const patch: Record<string, string> = {};
  const set = (aliases: string[], value: string) => {
    const hk = matchSheetHeader(headers, ...aliases);
    if (hk) patch[hk] = value;
  };
  if (body.fecha !== undefined) set(["Fecha_Factura", "Fecha", "FECHA"], String(body.fecha).trim());
  if (body.proveedor !== undefined) set(["Razon_Social", "Proveedor"], String(body.proveedor).trim());
  if (body.nit !== undefined) set(["Nit_Factura", "NIT"], String(body.nit).trim());
  if (body.numFactura !== undefined) {
    const v = String(body.numFactura).trim();
    const hkB = matchSheetHeader(headers, "Num_Factura");
    if (hkB) patch[hkB] = v;
    else set(["NumFactura", "No. Factura", "Número Factura"], v);
  }
  if (body.concepto !== undefined) set(["Observacion", "Concepto"], String(body.concepto).trim());
  if (body.valor !== undefined) set(["Monto_Factura", "Valor"], String(body.valor).trim());
  if (body.tipoFactura !== undefined) set(["Tipo_Factura", "TipoFactura"], String(body.tipoFactura).trim());
  if (body.servicioDeclarado !== undefined) {
    set(["Tipo_servicio", "ServicioDeclarado"], String(body.servicioDeclarado).trim());
  }
  if (body.tipoOperacion !== undefined) {
    set(["OPS", "TipoOperacion"], String(body.tipoOperacion).trim());
  }
  if (body.aNombreBia !== undefined) {
    const hk = matchSheetHeader(headers, "Nombre_bia", "ANombreBia", "Nombre bia");
    if (hk) patch[hk] = body.aNombreBia ? "TRUE" : "FALSE";
  }
  if (body.ciudad !== undefined) set(["Ciudad"], String(body.ciudad).trim());
  if (body.sector !== undefined) set(["Sector"], String(body.sector).trim());
  if (body.imagenUrl !== undefined) {
    const v = String(body.imagenUrl).trim();
    const adj = matchSheetHeader(headers, "Adjuntar_Factura");
    const url = matchSheetHeader(headers, "URL");
    if (adj) patch[adj] = v;
    if (url) patch[url] = v;
    set(["ImagenURL"], v);
  }
  if (body.driveFileId !== undefined) set(["DriveFileId"], String(body.driveFileId).trim());
  return patch;
}

export function mapEstadoPatchToSheet(
  headers: string[],
  estado: string,
  motivoRechazo: string
): Record<string, string> {
  const patch: Record<string, string> = {};
  const e = matchSheetHeader(headers, "Estado");
  if (e) patch[e] = estado;
  const leg = matchSheetHeader(headers, "Legalizado");
  if (leg) patch[leg] = estado;
  const ver = matchSheetHeader(headers, "Verificado");
  if (ver) patch[ver] = estado;
  const m = matchSheetHeader(headers, "MotivoRechazo", "Motivo Rechazo", "Motivo");
  if (m) patch[m] = motivoRechazo;
  return patch;
}

export async function loadMicajaFacturasSheetRows(): Promise<string[][]> {
  const rows = await getSheetData("MICAJA", SHEET_NAMES.FACTURAS);
  if (!rows.length || !rows[0]?.some((c) => String(c || "").trim())) {
    await appendSheetRow("MICAJA", SHEET_NAMES.FACTURAS, [...MICAJA_FACTURAS_HEADERS_LEGACY_AS]);
    return getSheetData("MICAJA", SHEET_NAMES.FACTURAS);
  }
  return rows;
}

export async function appendFacturaRowLegacyAS(values: string[]): Promise<void> {
  const range = `${quoteSheetTitleForRange(SHEET_NAMES.FACTURAS)}!A:S`;
  await getSheetsClient().spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_IDS.MICAJA,
    range,
    valueInputOption: "RAW",
    requestBody: { values: [values] },
  });
}

/** @deprecated Usar appendFacturaRowLegacyAS */
export async function appendFacturaRowRaw(values: string[]): Promise<void> {
  const range = `${quoteSheetTitleForRange(SHEET_NAMES.FACTURAS)}!A:AZ`;
  await getSheetsClient().spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_IDS.MICAJA,
    range,
    valueInputOption: "RAW",
    requestBody: { values: [values] },
  });
}

/** PUT desde `factura-form` (claves legado). */
export function legacyFacturaFormBodyToPatch(
  headers: string[],
  body: Record<string, unknown>
): Record<string, string> {
  const patch: Record<string, string> = {};
  const put = (aliases: string[], raw: unknown, xf?: (s: string) => string) => {
    if (raw === undefined || raw === null) return;
    let s = String(raw).trim();
    if (xf) s = xf(s);
    const hk = matchSheetHeader(headers, ...aliases);
    if (hk) patch[hk] = s;
  };
  const isoToDDMMSlash = (s: string) => {
    const m = s.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return s;
    return `${m[3]}/${m[2]}/${m[1]}`;
  };
  put(["Fecha_Factura", "Fecha", "FECHA"], body.Fecha_Factura, isoToDDMMSlash);
  put(["Razon_Social", "Proveedor"], body.Razon_Social);
  put(["Nit_Factura", "NIT"], body.Nit_Factura);
  put(["Num_Factura"], body.Num_Factura);
  put(["Observacion", "Concepto"], body.Observacion);
  put(["Monto_Factura", "Valor"], body.Monto_Factura);
  put(["Tipo_Factura", "TipoFactura"], body.Tipo_Factura);
  put(["Tipo_servicio", "ServicioDeclarado"], body.Tipo_servicio);
  put(["OPS", "TipoOperacion"], body.TipoOperacion);
  put(["Ciudad"], body.Ciudad);
  put(["Sector"], body.Sector);
  put(["Adjuntar_Factura", "ImagenURL"], body.Adjuntar_Factura);
  put(["URL"], body.Adjuntar_Factura);
  put(["Nombre_bia", "ANombreBia"], body.Nombre_bia, (s) => {
    const t = s.toLowerCase();
    return t === "sí" || t === "si" || t === "true" || t === "1" ? "TRUE" : "FALSE";
  });
  return patch;
}
