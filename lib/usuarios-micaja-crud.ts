import { normalizeEmailForAuth } from "@/lib/email-normalize";
import { getSupabase } from "@/lib/supabase";
import { invalidarCacheUsuarios } from "@/lib/usuarios-sheet";

export type UsuarioMicajaInput = {
  responsable: string;
  email: string;
  telefono?: string;
  rol: string;
  userActive: boolean;
  area: string;
  sector: string;
  cargo: string;
  cedula: string;
  pin?: string;
  telegramChatId?: string;
};

function normalizeRol(raw: string): "admin" | "coordinador" | "user" {
  const v = raw.trim().toLowerCase();
  return v === "admin" || v === "coordinador" ? v : "user";
}

function normalizeSectorEnum(raw: string): "Bogota" | "Costa Caribe" {
  const v = raw.trim().toLowerCase();
  if (v.includes("costa") || v.includes("caribe")) return "Costa Caribe";
  return "Bogota";
}

export async function appendUsuarioMicaja(input: UsuarioMicajaInput): Promise<void> {
  const payload = {
    responsable: input.responsable.trim(),
    correo: normalizeEmailForAuth(input.email),
    telefono: (input.telefono ?? "").trim() || null,
    rol: normalizeRol(input.rol),
    user_active: input.userActive,
    area: input.area.trim() || null,
    sector: normalizeSectorEnum(input.sector),
    cargo: input.cargo.trim() || null,
    cedula: input.cedula.trim() || null,
    pin: (input.pin ?? "1234").trim() || "1234",
    telegram_chat_id: (input.telegramChatId ?? "").trim() || null,
  };

  const { error } = await getSupabase().from("usuarios").insert(payload);
  if (error) throw error;
}

export type UsuarioMicajaPatch = {
  email: string;
  userActive?: boolean;
  responsable?: string;
  correos?: string;
  telefono?: string;
  rol?: string;
  area?: string;
  sector?: string;
  cargo?: string;
  cedula?: string;
  pin?: string;
  telegramChatId?: string;
};

export async function patchUsuarioMicaja(patch: UsuarioMicajaPatch): Promise<number> {
  const want = normalizeEmailForAuth(patch.email);
  if (!want) throw new Error("email inválido");

  const update: Record<string, unknown> = {};
  if (typeof patch.userActive === "boolean") update.user_active = patch.userActive;
  if (patch.responsable != null) update.responsable = patch.responsable.trim();
  if (patch.correos != null) update.correo = normalizeEmailForAuth(patch.correos);
  if (patch.telefono != null) update.telefono = patch.telefono.trim() || null;
  if (patch.rol != null) update.rol = normalizeRol(patch.rol);
  if (patch.area != null) update.area = patch.area.trim() || null;
  if (patch.sector != null) update.sector = normalizeSectorEnum(patch.sector);
  if (patch.cargo != null) update.cargo = patch.cargo.trim() || null;
  if (patch.cedula != null) update.cedula = patch.cedula.trim() || null;
  if (patch.pin != null) update.pin = patch.pin.trim() || "1234";
  if (patch.telegramChatId != null)
    update.telegram_chat_id = patch.telegramChatId.trim() || null;

  const { data, error } = await getSupabase()
    .from("usuarios")
    .update(update)
    .ilike("correo", want)
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

export async function deleteUsuarioMicajaByEmail(email: string): Promise<boolean> {
  const want = normalizeEmailForAuth(email);
  if (!want) throw new Error("email inválido");
  const { data, error } = await getSupabase()
    .from("usuarios")
    .delete()
    .ilike("correo", want)
    .select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/** Asocia el chat de Telegram al usuario e invalida caché. */
export async function patchUsuarioTelegramChatId(email: string, chatId: string): Promise<boolean> {
  const n = await patchUsuarioMicaja({ email, telegramChatId: chatId.trim() });
  if (n > 0) invalidarCacheUsuarios();
  return n > 0;
}
