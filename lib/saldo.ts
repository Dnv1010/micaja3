import type { EntregaRow, LegalizacionRow } from "@/types/models";
import { parseCOPString } from "@/lib/format";

export function computeSaldoResponsable(
  responsable: string,
  entregas: EntregaRow[],
  legalizaciones: LegalizacionRow[]
): number {
  const ent = entregas
    .filter((e) => e.Responsable === responsable)
    .reduce((a, e) => a + parseCOPString(e.Monto_Entregado || "0"), 0);
  const leg = legalizaciones
    .filter((l) => l.Responsable === responsable)
    .reduce((a, l) => a + parseCOPString(l.Total_Legalizado || "0"), 0);
  return ent - leg;
}

export function sedeFromUsuarioSector(sector: string): "Bogota" | "Costa Caribe" {
  const s = (sector || "").toLowerCase();
  if (s.includes("bogota")) return "Bogota";
  return "Costa Caribe";
}
