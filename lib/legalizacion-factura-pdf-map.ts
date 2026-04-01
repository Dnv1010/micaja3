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
  const driveId = String(getCellCaseInsensitive(f, "DriveFileId") || "").trim();
  const rawUrl = String(getCellCaseInsensitive(f, "Adjuntar_Factura", "URL", "ImagenURL") || "").trim();
  const imagenUrl = esUrlValida(rawUrl) ? rawUrl : undefined;
  const concepto = String(getCellCaseInsensitive(f, "Observacion", "Concepto") || "").trim();
  const conceptoLimpio =
    /^(cufe|cude)\s/i.test(concepto) || /^[a-f0-9]{30,}$/i.test(concepto.replace(/\s/g, ""))
      ? ""
      : concepto;
  return {
    id: String(getCellCaseInsensitive(f, "ID_Factura", "ID") || ""),
    fecha: String(getCellCaseInsensitive(f, "Fecha_Factura", "Fecha") || ""),
    proveedor: String(getCellCaseInsensitive(f, "Razon_Social", "Proveedor") || ""),
    nit: String(getCellCaseInsensitive(f, "Nit_Factura", "NIT") || ""),
    concepto: conceptoLimpio,
    valor: parseMonto(valorCell),
    tipoFactura: String(getCellCaseInsensitive(f, "Tipo_Factura", "TipoFactura") || ""),
    area: String(getCellCaseInsensitive(f, "Area", "Centro de Costo", "InfoCentroCosto") || defaults.area || ""),
    imagenUrl,
    driveFileId: driveId || undefined,
  };
}

/** Celda del reporte: array de objetos FacturaPdf o legacy array de IDs (strings). */
export function parseFacturasPdfFromReporteCell(raw: string): FacturaPdf[] | string[] | null {
  const t = raw?.trim();
  if (!t) return null;
  try {
    const p = JSON.parse(t) as unknown;
    if (!Array.isArray(p) || p.length === 0) return null;
    const first = p[0];
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

