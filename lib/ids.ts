export function uniqueSheetKey(prefix: string): string {
  const part = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
    : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${part}`.toUpperCase();
}
