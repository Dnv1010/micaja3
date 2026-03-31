import { assertSheetsConfigured, SPREADSHEET_IDS, SHEET_NAMES } from "@/lib/google-sheets";
import { getSheetDataBySpreadsheetId, rowsToObjects } from "@/lib/sheets-helpers";
import { normalizeEmailForAuth } from "@/lib/email-normalize";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";
import type { UsuarioRow } from "@/types/models";

function rowRecord(u: UsuarioRow): Record<string, unknown> {
  return u as unknown as Record<string, unknown>;
}

function usuarioEmailFromRow(u: UsuarioRow): string {
  return normalizeEmailForAuth(
    getCellCaseInsensitive(rowRecord(u), "Correos", "Correo", "Email", "E-mail", "Correo electrónico", "Correo electronico")
  );
}

function usuarioUserActiveFromRow(u: UsuarioRow): string {
  return getCellCaseInsensitive(rowRecord(u), "UserActive", "User Active", "Activo", "USERACTIVE", "User_Active");
}

/** Valor de la columna PIN (mayúsculas/minúsculas en encabezado). */
export function usuarioPinFromRow(u: UsuarioRow): string {
  return getCellCaseInsensitive(rowRecord(u), "PIN", "Pin", "pin");
}

export type UsuarioRowWithSource = UsuarioRow & {
  _usuariosSource?: "PETTY_CASH" | "MICAJA";
  /** ID del spreadsheet donde está la fila (para PATCH). */
  _usuariosSpreadsheetId?: string;
};

/** Nombre de la pestaña (debe coincidir con Google Sheets). */
function usuariosTabName(): string {
  return process.env.USUARIOS_SHEET_NAME?.trim() || SHEET_NAMES.USUARIOS;
}

/**
 * Todos los spreadsheets donde buscar "Usuarios" (sin duplicar ID).
 * Importante: USUARIOS_SPREADSHEET_ID es *adicional*, no reemplaza a Petty/MiCaja
 * (antes si estaba mal configurado, solo se leía un archivo y fallaba el login).
 */
function idsToScanUsuarios(): { id: string; source: "PETTY_CASH" | "MICAJA" }[] {
  const seen = new Set<string>();
  const out: { id: string; source: "PETTY_CASH" | "MICAJA" }[] = [];

  const add = (raw: string | undefined, source: "PETTY_CASH" | "MICAJA") => {
    const id = raw?.trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push({ id, source });
  };

  add(SPREADSHEET_IDS.PETTY_CASH, "PETTY_CASH");
  add(SPREADSHEET_IDS.MICAJA, "MICAJA");
  add(process.env.USUARIOS_SPREADSHEET_ID, "MICAJA");

  return out;
}

/** Lista fusionada: si un correo está en ambos libros, gana el último escaneado (MiCaja sobre Petty Cash). */
export async function loadUsuariosMerged(): Promise<UsuarioRowWithSource[]> {
  const byEmail = new Map<string, UsuarioRowWithSource>();

  for (const { id, source } of idsToScanUsuarios()) {
    try {
      const rows = await getSheetDataBySpreadsheetId(id, usuariosTabName());
      if (rows.length < 2) continue;
      const list = rowsToObjects<UsuarioRow>(rows);
      for (const u of list) {
        const mail = usuarioEmailFromRow(u);
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

  try {
    assertSheetsConfigured();
  } catch {
    console.error(
      "[MiCaja auth] Google Sheets no configurado: GOOGLE_SERVICE_ACCOUNT_EMAIL y GOOGLE_PRIVATE_KEY en Vercel (en la clave, los saltos de línea suelen ir como \\n en una sola línea)."
    );
    return null;
  }

  const ids = idsToScanUsuarios();
  if (ids.length === 0) {
    console.error(
      "[MiCaja auth] Ningún spreadsheet con Usuarios: define PETTY_CASH_SPREADSHEET_ID, MICAJA_SPREADSHEET_ID y/o USUARIOS_SPREADSHEET_ID en Vercel."
    );
    return null;
  }

  let foundInactive = false;

  for (const { id } of ids) {
    try {
      const rows = await getSheetDataBySpreadsheetId(id, usuariosTabName());
      if (rows.length < 2) continue;
      const usuarios = rowsToObjects<UsuarioRow>(rows);
      const found = usuarios.find((u) => usuarioEmailFromRow(u) === want);
      if (!found) continue;
      const activeRaw = usuarioUserActiveFromRow(found);
      if (isUserActiveInSheet(activeRaw)) return found;
      foundInactive = true;
      console.warn(
        `[MiCaja auth] Fila encontrada para ${want} en …${id.slice(-6)} pero UserActive no es activo (valor: "${activeRaw || "(vacío)"}").`
      );
    } catch (e) {
      console.error(`[MiCaja auth] Error leyendo Usuarios en spreadsheet ${id.slice(0, 8)}…`, e);
    }
  }

  if (!foundInactive) {
    console.warn(
      `[MiCaja auth] Sin fila con correo ${want} en ${ids.length} libro(s). Revisa encabezado tipo Correos/Email y pestaña "${usuariosTabName()}".`
    );
  }

  return null;
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
