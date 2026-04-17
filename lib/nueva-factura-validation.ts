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
  // Colombia es UTC-5 sin DST. Comparamos por string YYYY-MM-DD en Colombia
  // para que no dependa del timezone del server (Vercel corre en UTC).
  const COLOMBIA_OFFSET_MS = 5 * 60 * 60 * 1000;
  const nowCO = new Date(Date.now() - COLOMBIA_OFFSET_MS);
  const todayCO = nowCO.toISOString().slice(0, 10);
  const fechaStr =
    `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
  return fechaStr > todayCO;
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
