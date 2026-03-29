import { SPREADSHEET_IDS, SHEET_NAMES } from "@/lib/google-sheets";
import { getSheetDataBySpreadsheetId, rowsToObjects } from "@/lib/sheets-helpers";
import { normalizeEmailForAuth } from "@/lib/email-normalize";
import type { UsuarioRow } from "@/types/models";

export type UsuarioRowWithSource = UsuarioRow & {
  _usuariosSource?: "PETTY_CASH" | "MICAJA";
  /** ID del spreadsheet donde está la fila (para PATCH). */
  _usuariosSpreadsheetId?: string;
};

/** Orden de lectura: explícito → Petty Cash → libro MiCaja (misma pestaña "Usuarios"). */
function idsToScanUsuarios(): { id: string; source: "PETTY_CASH" | "MICAJA" }[] {
  const explicit = process.env.USUARIOS_SPREADSHEET_ID?.trim();
  if (explicit) {
    return [{ id: explicit, source: "PETTY_CASH" }];
  }
  const out: { id: string; source: "PETTY_CASH" | "MICAJA" }[] = [];
  const petty = SPREADSHEET_IDS.PETTY_CASH?.trim();
  const micaja = SPREADSHEET_IDS.MICAJA?.trim();
  if (petty) out.push({ id: petty, source: "PETTY_CASH" });
  if (micaja && micaja !== petty) out.push({ id: micaja, source: "MICAJA" });
  return out;
}

/** Lista fusionada: si un correo está en ambos libros, gana el último escaneado (MiCaja sobre Petty Cash). */
export async function loadUsuariosMerged(): Promise<UsuarioRowWithSource[]> {
  const byEmail = new Map<string, UsuarioRowWithSource>();

  for (const { id, source } of idsToScanUsuarios()) {
    try {
      const rows = await getSheetDataBySpreadsheetId(id, SHEET_NAMES.USUARIOS);
      if (rows.length < 2) continue;
      const list = rowsToObjects<UsuarioRow>(rows);
      for (const u of list) {
        const mail = normalizeEmailForAuth(String(u.Correos ?? ""));
        if (!mail) continue;
        byEmail.set(mail, { ...u, _usuariosSource: source, _usuariosSpreadsheetId: id });
      }
    } catch {
      /* siguiente fuente */
    }
  }

  return Array.from(byEmail.values());
}

/** Solo para login: encuentra usuario activo por correo (prueba Petty Cash y luego MiCaja). */
export async function findUsuarioByEmailForAuth(email: string): Promise<UsuarioRow | null> {
  const want = normalizeEmailForAuth(email);
  if (!want) return null;

  for (const { id } of idsToScanUsuarios()) {
    try {
      const rows = await getSheetDataBySpreadsheetId(id, SHEET_NAMES.USUARIOS);
      if (rows.length < 2) continue;
      const usuarios = rowsToObjects<UsuarioRow>(rows);
      const found = usuarios.find((u) => normalizeEmailForAuth(String(u.Correos ?? "")) === want);
      if (found && isUserActiveInSheet(found.UserActive)) return found;
    } catch (e) {
      console.error(`[MiCaja auth] Error leyendo Usuarios en spreadsheet ${id.slice(0, 8)}…`, e);
    }
  }

  return null;
}

export function isUserActiveInSheet(value: string | undefined): boolean {
  const v = String(value || "")
    .trim()
    .toUpperCase();
  return v === "TRUE" || v === "SI" || v === "SÍ" || v === "YES" || v === "1";
}
