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
  assignee: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  is_active: boolean | null;
  area: string | null;
  region: string | null;
  job_title: string | null;
  document_number: string | null;
  pin: string | null;
  telegram_chat_id: string | null;
};

function dbRowToApiRow(r: UsuariosDbRow, rowIndex: number): UsuarioRowWithSource {
  return {
    _rowIndex: rowIndex,
    Responsable: (r.assignee ?? "").trim(),
    Correos: normalizeEmailForAuth(String(r.email ?? "")),
    Telefono: (r.phone ?? "").trim(),
    Rol: (r.role ?? "").trim(),
    UserActive: r.is_active ? "TRUE" : "FALSE",
    Area: (r.area ?? "").trim(),
    Cargo: (r.job_title ?? "").trim(),
    Cedula: (r.document_number ?? "").trim(),
    Sector: (r.region ?? "").trim(),
    PIN: (r.pin ?? "").trim(),
    _usuariosSource: "SUPABASE",
  } as UsuarioRowWithSource;
}

export async function loadUsuariosMerged(): Promise<UsuarioRowWithSource[]> {
  const { data, error } = await getSupabase()
    .from(TABLES.users)
    .select(
      "assignee, email, phone, role, is_active, area, region, job_title, document_number, pin, telegram_chat_id"
    );
  if (error) {
    console.error("[usuarios-data] Supabase error:", error);
    return [];
  }
  return (data as UsuariosDbRow[]).map((r, i) => dbRowToApiRow(r, i + 2));
}

/** Solo para login: encuentra usuario activo por email. */
export async function findUsuarioByEmailForAuth(email: string): Promise<UsuarioRow | null> {
  const want = normalizeEmailForAuth(email);
  if (!want) return null;

  const { data, error } = await getSupabase()
    .from(TABLES.users)
    .select(
      "assignee, email, phone, role, is_active, area, region, job_title, document_number, pin, telegram_chat_id"
    )
    .ilike("email", want)
    .limit(1);
  if (error) {
    console.error("[MiCaja auth] Supabase error:", error);
    return null;
  }
  if (!data || data.length === 0) {
    console.warn(`[MiCaja auth] Sin usuario con email ${want}`);
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

/** Actualiza is_active por email. Retorna nº de filas modificadas. */
export async function patchUsuarioUserActiveByEmail(
  email: string,
  userActive: boolean
): Promise<number> {
  const want = normalizeEmailForAuth(email);
  if (!want) throw new Error("email inválido");

  const { data, error } = await getSupabase()
    .from(TABLES.users)
    .update({ is_active: userActive, updated_at: new Date().toISOString() })
    .ilike("email", want)
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

export { isUserActiveInSheet } from "@/lib/usuario-sheet-fields";
