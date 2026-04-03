import { getCellCaseInsensitive } from "@/lib/sheet-cell";
import type { FacturaRow } from "@/types/models";

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
  const nit = opts.nit.trim();
  const num = opts.numFactura.trim().toLowerCase();
  const resp = opts.responsable.trim().toLowerCase();
  if (!nit || !num) return undefined;

  return facturas.find((f) => {
    const idF = String(getCellCaseInsensitive(f, "ID_Factura", "ID") || "").trim();
    if (opts.excludeFacturaId && idF === opts.excludeFacturaId) return false;

    const nitF = String(getCellCaseInsensitive(f, "Nit_Factura", "NIT") || "").trim();
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
