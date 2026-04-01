export function normalizeSector(raw: string): "Bogota" | "Costa Caribe" | null {
  const v = String(raw || "").trim().toLowerCase();
  if (v === "bogota" || v === "bogotá" || v === "bogota dc" || v === "bogotá dc") return "Bogota";
  if (
    v === "costa caribe" ||
    v === "costa" ||
    v === "caribe" ||
    v === "barranquilla" ||
    v === "cartagena" ||
    v === "santa marta"
  ) {
    return "Costa Caribe";
  }
  return null;
}

/** Compara sectores de sesión, query o Sheet (acepta alias como "Costa" vs "Costa Caribe"). */
export function sectorsEquivalent(a: string, b: string): boolean {
  const ca = normalizeSector(a);
  const cb = normalizeSector(b);
  if (ca !== null && cb !== null) return ca === cb;
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}
