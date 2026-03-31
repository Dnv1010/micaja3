/** Fecha en formulario DD/MM/YYYY */
export function parseFechaFacturaDDMMYYYY(s: string): Date | null {
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const day = +m[1];
  const month = +m[2];
  const year = +m[3];
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
}

export function isFechaFacturaFutura(fecha: Date): boolean {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return fecha.getTime() > today.getTime();
}

/** NIT declarado corresponde a BIA Energy (901.588.413-x). */
export function nitIndicaBiaEnergy(nit: string): boolean {
  const digits = nit.replace(/\D/g, "");
  return digits.includes("901588413");
}

export function sheetANombreBiaTrue(raw: string): boolean {
  const t = raw.trim().toLowerCase();
  return t === "sí" || t === "si" || t === "true" || t === "1" || t === "yes";
}
