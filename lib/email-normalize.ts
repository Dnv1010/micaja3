/** Normaliza correo para comparar con la hoja (espacios raros de Sheets, mayúsculas). */
export function normalizeEmailForAuth(email: string): string {
  return email
    .normalize("NFKC")
    .replace(/[\u00a0\u200b-\u200d\ufeff\uFEFF]/g, "")
    .trim()
    .toLowerCase();
}

/** Cuenta corporativa BIA: @bia.app o subdominio tipo @equipo.bia.app (Google Workspace). */
export function isBiaAppEmail(normalizedEmail: string): boolean {
  const at = normalizedEmail.lastIndexOf("@");
  if (at < 0) return false;
  const domain = normalizedEmail.slice(at + 1);
  return domain === "bia.app" || domain.endsWith(".bia.app");
}
