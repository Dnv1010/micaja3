import { normalizeEmailForAuth } from "@/lib/email-normalize";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";

/** Email normalizado desde una fila de hoja Usuarios (también para JSON de API en cliente). */
export function usuarioSheetEmail(u: Record<string, unknown>): string {
  return normalizeEmailForAuth(
    getCellCaseInsensitive(u, "Correos", "Correo", "Email", "E-mail", "Correo electrónico", "Correo electronico")
  );
}

export function usuarioSheetUserActiveRaw(u: Record<string, unknown>): string {
  return getCellCaseInsensitive(u, "UserActive", "User Active", "Activo", "USERACTIVE", "User_Active");
}

export function isUserActiveInSheet(value: string | undefined): boolean {
  const v = String(value || "")
    .trim()
    .toUpperCase();
  return (
    v === "TRUE" ||
    v === "SI" ||
    v === "SÍ" ||
    v === "YES" ||
    v === "1" ||
    v === "VERDADERO"
  );
}
