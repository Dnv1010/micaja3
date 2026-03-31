/** Límite de total a aprobar por reporte según zona (COP). */
export function limiteAprobacionZona(sector: string): number {
  const s = sector.toLowerCase();
  if (s.includes("bogota")) return 1_000_000;
  return 3_000_000;
}

export function etiquetaZona(sector: string): string {
  const s = sector.toLowerCase();
  if (s.includes("bogota")) return "Bogotá";
  if (s.includes("costa")) return "Costa Caribe";
  return sector || "Zona";
}
