/**
 * Google Sheets devuelve encabezados tal cual están escritos; si difieren en mayúsculas
 * o usan alias ("Email" vs "Correos"), las propiedades del objeto no coinciden con UsuarioRow.
 */
export function getCellCaseInsensitive(row: Record<string, unknown>, ...headerAliases: string[]): string {
  if (!headerAliases.length) return "";
  const norm = (s: string) =>
    String(s ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFKC");
  const wanted = new Set(headerAliases.map(norm));
  for (const key of Object.keys(row)) {
    if (key === "_rowIndex") continue;
    if (wanted.has(norm(key))) {
      const v = row[key];
      return v === undefined || v === null ? "" : String(v).trim();
    }
  }
  return "";
}
