/** Normaliza correo para comparar con la hoja (espacios raros de Sheets, mayúsculas). */
export function normalizeEmailForAuth(email: string): string {
  return email
    .normalize("NFKC")
    .replace(/[\u00a0\u200b-\u200d\ufeff\uFEFF]/g, "")
    .trim()
    .toLowerCase();
}
