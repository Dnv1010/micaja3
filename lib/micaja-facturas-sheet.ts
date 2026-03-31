import {
  getSheetsClient,
  SHEET_NAMES,
  SPREADSHEET_IDS,
} from "@/lib/google-sheets";
import {
  appendSheetRow,
  ensureMicajaFacturasNumFacturaColumn,
  getSheetData,
  quoteSheetTitleForRange,
} from "@/lib/sheets-helpers";

export const MICAJA_FACTURAS_DEFAULT_HEADERS = [
  "ID",
  "Fecha",
  "Responsable",
  "Area",
  "Sector",
  "Ciudad",
  "Proveedor",
  "NIT",
  "NumFactura",
  "Concepto",
  "Valor",
  "TipoFactura",
  "ServicioDeclarado",
  "TipoOperacion",
  "ANombreBia",
  "Estado",
  "MotivoRechazo",
  "ImagenURL",
  "DriveFileId",
  "FechaCreacion",
] as const;

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
  if (n === "id") return f.id;
  if (n === "fecha") return f.fecha;
  if (n === "responsable") return f.responsable;
  if (n === "area") return f.area;
  if (n === "sector") return f.sector;
  if (n === "ciudad") return f.ciudad;
  if (n === "proveedor") return f.proveedor;
  if (n === "nit") return f.nit;
  if (n === "numfactura" || n === "nofactura" || n === "numerodefactura" || n.includes("numerofactura")) {
    return f.numFactura;
  }
  if (n === "concepto") return f.concepto;
  if (n === "valor" || n === "monto") return f.valor;
  if (n === "tipofactura") return f.tipoFactura;
  if (n === "serviciodeclarado") return f.servicioDeclarado;
  if (n === "tipooperacion") return f.tipoOperacion;
  if (n === "anombrebia" || n === "nombrebia") {
    return f.aNombreBia ? "TRUE" : "FALSE";
  }
  if (n === "estado") return f.estado;
  if (n === "motivorechazo" || n.includes("motivo")) return f.motivoRechazo;
  if (n === "imagenurl" || n === "url" || n.includes("imagen")) return f.imagenUrl;
  if (n === "drivefileid" || n.includes("drive")) return f.driveFileId;
  if (n === "fechacreacion") return f.fechaCreacion;
  return "";
}

/** Una celda por columna según el orden real de la fila de encabezados. */
export function buildFacturaRowForHeaders(headers: string[], f: FacturaSheetWriteFields): string[] {
  return headers.map((h) => cellForNormalizedHeader(normalizeFacturaHeader(String(h)), f));
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
  if (body.fecha !== undefined) set(["Fecha", "FECHA"], String(body.fecha).trim());
  if (body.proveedor !== undefined) set(["Proveedor", "Razon_Social"], String(body.proveedor).trim());
  if (body.nit !== undefined) set(["NIT", "Nit_Factura"], String(body.nit).trim());
  if (body.numFactura !== undefined) set(["NumFactura", "No. Factura", "Número Factura"], String(body.numFactura).trim());
  if (body.concepto !== undefined) set(["Concepto"], String(body.concepto).trim());
  if (body.valor !== undefined) set(["Valor", "Monto_Factura"], String(body.valor).trim());
  if (body.tipoFactura !== undefined) set(["TipoFactura", "Tipo_Factura"], String(body.tipoFactura).trim());
  if (body.servicioDeclarado !== undefined) set(["ServicioDeclarado", "Tipo_servicio"], String(body.servicioDeclarado).trim());
  if (body.tipoOperacion !== undefined) set(["TipoOperacion"], String(body.tipoOperacion).trim());
  if (body.aNombreBia !== undefined) {
    const hk = matchSheetHeader(headers, "ANombreBia", "Nombre_bia", "Nombre bia");
    if (hk) patch[hk] = body.aNombreBia ? "TRUE" : "FALSE";
  }
  if (body.ciudad !== undefined) set(["Ciudad"], String(body.ciudad).trim());
  if (body.sector !== undefined) set(["Sector"], String(body.sector).trim());
  if (body.imagenUrl !== undefined) set(["ImagenURL", "URL", "Adjuntar_Factura"], String(body.imagenUrl).trim());
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
  const m = matchSheetHeader(headers, "MotivoRechazo", "Motivo Rechazo");
  if (m) patch[m] = motivoRechazo;
  return patch;
}

export async function loadMicajaFacturasSheetRows(): Promise<string[][]> {
  try {
    await ensureMicajaFacturasNumFacturaColumn();
  } catch (e) {
    console.error("ensureMicajaFacturasNumFacturaColumn:", e);
  }
  const rows = await getSheetData("MICAJA", SHEET_NAMES.FACTURAS);
  if (!rows.length || !rows[0]?.some((c) => String(c || "").trim())) {
    await appendSheetRow("MICAJA", SHEET_NAMES.FACTURAS, [...MICAJA_FACTURAS_DEFAULT_HEADERS]);
    return getSheetData("MICAJA", SHEET_NAMES.FACTURAS);
  }
  return rows;
}

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
  put(["Fecha", "FECHA"], body.Fecha_Factura, isoToDDMMSlash);
  put(["Proveedor", "Razon_Social"], body.Razon_Social);
  put(["NIT", "Nit_Factura"], body.Nit_Factura);
  put(["NumFactura", "Num_Factura"], body.Num_Factura);
  put(["Concepto"], body.Observacion);
  put(["Valor", "Monto_Factura"], body.Monto_Factura);
  put(["TipoFactura", "Tipo_Factura"], body.Tipo_Factura);
  put(["ServicioDeclarado", "Tipo_servicio"], body.Tipo_servicio);
  put(["TipoOperacion"], body.TipoOperacion);
  put(["Ciudad"], body.Ciudad);
  put(["Sector"], body.Sector);
  put(["ImagenURL", "URL", "Adjuntar_Factura"], body.Adjuntar_Factura);
  put(["ANombreBia", "Nombre_bia"], body.Nombre_bia, (s) => {
    const t = s.toLowerCase();
    return t === "sí" || t === "si" || t === "true" || t === "1" ? "TRUE" : "FALSE";
  });
  return patch;
}
