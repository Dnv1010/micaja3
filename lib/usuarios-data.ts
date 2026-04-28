import { normalizeEmailForAuth } from "@/lib/email-normalize";
import { isUserActiveInSheet } from "@/lib/usuario-sheet-fields";
import { getSupabase } from "@/lib/supabase";
import type { UsuarioRow } from "@/types/models";
import { TABLES } from "@/lib/db-tables";

export type UsuarioRowWithSource = UsuarioRow & {
  _usuariosSource?: "SUPABASE";
};

/** Valor de la columna PIN (se mantiene por compat con componentes admin). */
export function usuarioPinFromRow(u: UsuarioRow): string {
  return String((u as unknown as Record<string, unknown>).PIN ?? (u as unknown as Record<string, unknown>).pin ?? "");
}

type UsuariosDbRow = {
  responsable: string | null;
  correo: string | null;
  telefono: string | null;
  rol: string | null;
  user_active: boolean | null;
  area: string | null;
  sector: string | null;
  cargo: string | null;
  cedula: string | null;
  pin: string | null;
  telegram_chat_id: string | null;
};

function dbRowToApiRow(r: UsuariosDbRow, rowIndex: number): UsuarioRowWithSource {
  return {
    _rowIndex: rowIndex,
    Responsable: (r.responsable ?? "").trim(),
    Correos: normalizeEmailForAuth(String(r.correo ?? "")),
    Telefono: (r.telefono ?? "").trim(),
    Rol: (r.rol ?? "").trim(),
    UserActive: r.user_active ? "TRUE" : "FALSE",
    Area: (r.area ?? "").trim(),
    Cargo: (r.cargo ?? "").trim(),
    Cedula: (r.cedula ?? "").trim(),
    Sector: (r.sector ?? "").trim(),
    PIN: (r.pin ?? "").trim(),
    _usuariosSource: "SUPABASE",
  } as UsuarioRowWithSource;
}

export async function loadUsuariosMerged(): Promise<UsuarioRowWithSource[]> {
  const { data, error } = await getSupabase()
    .from(TABLES.users)
    .select(
      "responsable, correo, telefono, rol, user_active, area, sector, cargo, cedula, pin, telegram_chat_id"
    );
  if (error) {
    console.error("[usuarios-data] Supabase error:", error);
    return [];
  }
  return (data as UsuariosDbRow[]).map((r, i) => dbRowToApiRow(r, i + 2));
}

/** Solo para login: encuentra usuario activo por correo. */
export async function findUsuarioByEmailForAuth(email: string): Promise<UsuarioRow | null> {
  const want = normalizeEmailForAuth(email);
  if (!want) return null;

  const { data, error } = await getSupabase()
    .from(TABLES.users)
    .select(
      "responsable, correo, telefono, rol, user_active, area, sector, cargo, cedula, pin, telegram_chat_id"
    )
    .ilike("correo", want)
    .limit(1);
  if (error) {
    console.error("[MiCaja auth] Supabase error:", error);
    return null;
  }
  if (!data || data.length === 0) {
    console.warn(`[MiCaja auth] Sin usuario con correo ${want}`);
    return null;
  }
  const row = data[0] as UsuariosDbRow;
  const apiRow = dbRowToApiRow(row, 2);
  if (!isUserActiveInSheet(apiRow.UserActive)) {
    console.warn(`[MiCaja auth] Usuario ${want} inactivo (UserActive=${apiRow.UserActive})`);
    return null;
  }
  return apiRow;
}

/** Actualiza user_active por correo. Retorna nº de filas modificadas. */
export async function patchUsuarioUserActiveByEmail(
  email: string,
  userActive: boolean
): Promise<number> {
  const want = normalizeEmailForAuth(email);
  if (!want) throw new Error("email inválido");

  const { data, error } = await getSupabase()
    .from(TABLES.users)
    .update({ user_active: userActive, updated_at: new Date().toISOString() })
    .ilike("correo", want)
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

export { isUserActiveInSheet } from "@/lib/usuario-sheet-fields";
