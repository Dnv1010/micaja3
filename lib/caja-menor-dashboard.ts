import { limiteAprobacionZona } from "@/lib/coordinador-zona";
import { parseMonto } from "@/lib/format";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";
import { normalizeSector } from "@/lib/sector-normalize";

export type CajaMenorMetricasUsuario = {
  totalRecibido: number;
  totalAprobado: number;
  totalPendiente: number;
  countPendiente: number;
  disponible: number;
  limiteZona: number;
  pctEjecutado: number;
};

/** Límite COP por técnico y período según zona (Bogotá 1M, Costa Caribe 3M). */
export function limiteCajaTecnicoPorSector(sector: string): number {
  return limiteAprobacionZona(sector);
}

export function estadoFacturaCajaRow(row: Record<string, unknown>): string {
  return String(getCellCaseInsensitive(row, "Verificado", "Estado", "Legalizado") || "pendiente")
    .trim()
    .toLowerCase();
}

export function montoFacturaRow(row: Record<string, unknown>): number {
  return parseMonto(getCellCaseInsensitive(row, "Monto_Factura", "Valor"));
}

export function montoEntregaRow(row: Record<string, unknown>): number {
  return parseMonto(getCellCaseInsensitive(row, "Monto_Entregado", "Monto"));
}

function responsableKey(row: Record<string, unknown>): string {
  return String(getCellCaseInsensitive(row, "Responsable") || "").trim().toLowerCase();
}

/** Métricas de caja para un técnico (facturas y entregas ya filtradas o globales). */
export function metricasCajaMenorUsuario(
  facturas: Record<string, unknown>[],
  entregas: Record<string, unknown>[],
  responsable: string,
  sector: string
): CajaMenorMetricasUsuario {
  const rk = responsable.trim().toLowerCase();
  const limiteZona = limiteCajaTecnicoPorSector(sector);

  const totalRecibido = entregas
    .filter((e) => responsableKey(e) === rk)
    .reduce((s, e) => s + montoEntregaRow(e), 0);

  const facturasUser = facturas.filter((f) => responsableKey(f) === rk);

  const totalAprobado = facturasUser
    .filter((f) => {
      const est = estadoFacturaCajaRow(f);
      return est === "aprobada" || est === "completada";
    })
    .reduce((s, f) => s + montoFacturaRow(f), 0);

  const pendientes = facturasUser.filter((f) => estadoFacturaCajaRow(f) === "pendiente");
  const totalPendiente = pendientes.reduce((s, f) => s + montoFacturaRow(f), 0);
  const countPendiente = pendientes.length;

  const disponible = totalRecibido - totalAprobado - totalPendiente;
  const pctEjecutado =
    limiteZona > 0 ? Math.round((totalAprobado / limiteZona) * 100) : 0;

  return {
    totalRecibido,
    totalAprobado,
    totalPendiente,
    countPendiente,
    disponible,
    limiteZona,
    pctEjecutado,
  };
}

/** Sector canónico de una fila de factura (para agregados por zona). */
export function sectorFacturaCanon(row: Record<string, unknown>): "Bogota" | "Costa Caribe" | null {
  return normalizeSector(getCellCaseInsensitive(row, "Sector") || "");
}

export function sumasFacturasZona(
  facturas: Record<string, unknown>[],
  zona: "Bogota" | "Costa Caribe"
): { totalAprobado: number; totalPendiente: number } {
  let totalAprobado = 0;
  let totalPendiente = 0;
  for (const f of facturas) {
    if (sectorFacturaCanon(f) !== zona) continue;
    const est = estadoFacturaCajaRow(f);
    const m = montoFacturaRow(f);
    if (est === "aprobada" || est === "completada") totalAprobado += m;
    else if (est === "pendiente") totalPendiente += m;
  }
  return { totalAprobado, totalPendiente };
}
