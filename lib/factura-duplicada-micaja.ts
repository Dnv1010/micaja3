import { getCellCaseInsensitive } from "@/lib/sheet-cell";
import type { FacturaRow } from "@/types/models";

/** NIT sin espacios/guiones/caracteres para comparar entre formatos distintos. */
function normalizeNit(s: string): string {
  return s.replace(/\D/g, "");
}

/** Duplicado si coinciden NIT, número de factura y responsable (comparación case-insensitive en número y responsable). */
export function findFacturaDuplicadaPorNitNumResponsable(
  facturas: FacturaRow[],
  opts: {
    nit: string;
    numFactura: string;
    responsable: string;
    excludeFacturaId?: string;
  }
): FacturaRow | undefined {
  const nit = normalizeNit(opts.nit);
  const num = opts.numFactura.trim().toLowerCase();
  const resp = opts.responsable.trim().toLowerCase();
  if (!nit || !num) return undefined;

  return facturas.find((f) => {
    const idF = String(getCellCaseInsensitive(f, "ID_Factura", "ID") || "").trim();
    if (opts.excludeFacturaId && idF === opts.excludeFacturaId) return false;

    const nitF = normalizeNit(String(getCellCaseInsensitive(f, "Nit_Factura", "NIT") || ""));
    const numF = String(getCellCaseInsensitive(f, "Num_Factura", "NumFactura") || "")
      .trim()
      .toLowerCase();
    const respF = String(getCellCaseInsensitive(f, "Responsable") || "").trim().toLowerCase();

    return nitF === nit && numF === num && respF === resp;
  });
}

/** Estado mostrado al usuario cuando bloqueamos por duplicado (POST). */
export function estadoFacturaDuplicadaMensaje(f: FacturaRow): string {
  return getCellCaseInsensitive(f, "Verificado", "Estado", "Legalizado") || "Pendiente";
}
