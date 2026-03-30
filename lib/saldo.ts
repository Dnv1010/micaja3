import type { EntregaRow, LegalizacionRow } from "@/types/models";
import { parseCOPString } from "@/lib/format";
import { entregaMonto, entregaResponsable, legalizacionResponsable, legalizacionTotal } from "@/lib/row-fields";

export function computeSaldoResponsable(
  responsable: string,
  entregas: EntregaRow[],
  legalizaciones: LegalizacionRow[]
): number {
  const ent = entregas
    .filter((e) => entregaResponsable(e) === responsable)
    .reduce((a, e) => a + parseCOPString(entregaMonto(e) || "0"), 0);
  const leg = legalizaciones
    .filter((l) => legalizacionResponsable(l) === responsable)
    .reduce((a, l) => a + parseCOPString(legalizacionTotal(l) || "0"), 0);
  return ent - leg;
}

export function sedeFromUsuarioSector(sector: string): "Bogota" | "Costa Caribe" {
  const s = (sector || "").toLowerCase();
  if (s.includes("bogota")) return "Bogota";
  return "Costa Caribe";
}
