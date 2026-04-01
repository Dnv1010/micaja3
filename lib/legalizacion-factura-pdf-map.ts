import type { FacturaPdf } from "@/components/pdf/legalizacion-pdf";
import { parseMonto } from "@/lib/format";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";

type FacturaLike = Record<string, unknown>;

function esUrlValida(url: string): boolean {
  const u = url.trim();
  return u.startsWith("http://") || u.startsWith("https://") || u.startsWith("data:");
}

/** Mapeo desde fila de Sheet / API hacia el payload del PDF (coordinador o admin). */
export function facturaRowToFacturaPdfForLegalizacion(
  f: FacturaLike,
  defaults: { area?: string }
): FacturaPdf {
  const valorCell = getCellCaseInsensitive(f, "Monto_Factura", "Valor");
  const driveId = String(getCellCaseInsensitive(f, "DriveFileId", "driveFileId") || "").trim();
  const rawUrl = String(
    getCellCaseInsensitive(f, "Adjuntar_Factura", "URL", "ImagenURL", "imagenUrl") || ""
  ).trim();
  const imagenUrl = esUrlValida(rawUrl) ? rawUrl : undefined;
  const concepto = String(
    getCellCaseInsensitive(
      f,
      "Tipo_servicio",
      "ServicioDeclarado",
      "Observacion",
      "Concepto",
      "tipo_servicio",
      "servicioDeclarado"
    ) || ""
  ).trim();
  const conceptoLimpio =
    /^(cufe|cude)\s/i.test(concepto) || /^[a-f0-9]{30,}$/i.test(concepto.replace(/\s/g, ""))
      ? ""
      : concepto;

  const ops = String(
    getCellCaseInsensitive(f, "OPS", "TipoOperacion", "Tipo_Operacion", "ops") || ""
  ).trim();
  const areaCentro =
    ops ||
    String(
      getCellCaseInsensitive(f, "Area", "Centro de Costo", "InfoCentroCosto", "Sector") ||
        defaults.area ||
        ""
    );

  const numFactura = String(
    getCellCaseInsensitive(f, "Num_Factura", "NumFactura", "num_factura", "numFactura") || ""
  ).trim();
  const numFacturaLegacy = numFactura || String(getCellCaseInsensitive(f, "nit") || "").trim();

  return {
    id: String(getCellCaseInsensitive(f, "ID_Factura", "ID") || ""),
    fecha: String(getCellCaseInsensitive(f, "Fecha_Factura", "Fecha") || ""),
    proveedor: String(getCellCaseInsensitive(f, "Razon_Social", "Proveedor") || ""),
    nit: numFacturaLegacy,
    concepto: conceptoLimpio,
    valor: parseMonto(valorCell),
    tipoFactura: String(getCellCaseInsensitive(f, "Tipo_Factura", "TipoFactura") || ""),
    area: areaCentro,
    imagenUrl,
    driveFileId: driveId || undefined,
  };
}

/** Celda como string JSON (a veces doble-serializada en Sheet). */
export function parseFacturasJsonFromSheetCell(raw: string): unknown {
  const t = String(raw ?? "").trim();
  if (!t) return [];
  try {
    let cur: unknown = JSON.parse(t);
    if (typeof cur === "string") cur = JSON.parse(cur);
    return cur;
  } catch {
    return null;
  }
}

/** Celda del reporte: array de objetos FacturaPdf o legacy array de IDs (strings). */
export function parseFacturasPdfFromReporteCell(raw: string): FacturaPdf[] | string[] | null {
  const t = raw?.trim();
  if (!t) return null;
  try {
    const p = parseFacturasJsonFromSheetCell(t);
    if (p == null) return null;
    if (!Array.isArray(p) || p.length === 0) return null;
    const first = p[0] as unknown;
    if (typeof first === "string") {
      return p.map(String);
    }
    if (typeof first === "object" && first !== null) {
      return p as FacturaPdf[];
    }
    return null;
  } catch {
    return null;
  }
}

/** IDs para marcar facturas Completada o para fetch; soporta celda con objetos o strings. */
export function extractIdsFromReporteFacturasCell(raw: string): string[] {
  const parsed = parseFacturasPdfFromReporteCell(raw);
  if (!parsed?.length) {
    return String(raw || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (typeof parsed[0] === "string") {
    return parsed as string[];
  }
  return (parsed as FacturaPdf[]).map((x) => String(x.id || "").trim()).filter(Boolean);
}

