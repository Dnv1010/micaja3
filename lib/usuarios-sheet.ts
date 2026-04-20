import { normalizeEmailForAuth } from "@/lib/email-normalize";
import { normalizeSector } from "@/lib/sector-normalize";
import { getSupabase } from "@/lib/supabase";

export type UsuarioSheet = {
  responsable: string;
  email: string;
  telefono: string;
  rol: "user" | "coordinador" | "admin";
  userActive: boolean;
  area: string;
  sector: "Bogota" | "Costa Caribe";
  cargo: string;
  cedula: string;
  pin: string;
  telegram_chat_id?: string;
};

let cache: UsuarioSheet[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000;

export function sheetSectorToCanon(raw: string): "Bogota" | "Costa Caribe" {
  const n = normalizeSector(raw);
  if (n) return n;
  const v = raw.trim().toLowerCase();
  if (
    v.includes("costa") ||
    v.includes("caribe") ||
    v.includes("barranquilla") ||
    v.includes("cartagena") ||
    v.includes("santa marta")
  ) {
    return "Costa Caribe";
  }
  return "Bogota";
}

type UsuarioDbRow = {
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

function rowToUsuarioSheet(r: UsuarioDbRow): UsuarioSheet | null {
  const email = normalizeEmailForAuth(String(r.correo ?? ""));
  if (!email) return null;
  const rolRaw = String(r.rol ?? "user").toLowerCase().trim();
  const rol: UsuarioSheet["rol"] = ["admin", "coordinador", "user"].includes(rolRaw)
    ? (rolRaw as UsuarioSheet["rol"])
    : "user";
  const chat = (r.telegram_chat_id ?? "").trim();
  return {
    responsable: (r.responsable ?? "").trim(),
    email,
    telefono: (r.telefono ?? "").replace(/[^0-9]/g, ""),
    rol,
    userActive: r.user_active !== false,
    area: (r.area ?? "").trim(),
    sector: sheetSectorToCanon(String(r.sector ?? "")),
    cargo: (r.cargo ?? "").trim(),
    cedula: (r.cedula ?? "").trim(),
    pin: ((r.pin ?? "").trim() || "1234"),
    telegram_chat_id: chat || undefined,
  };
}

export async function getUsuariosFromSheet(): Promise<UsuarioSheet[]> {
  const now = Date.now();
  if (cache && now - cacheTimestamp < CACHE_TTL) return cache;

  const { data, error } = await getSupabase()
    .from("usuarios")
    .select(
      "responsable, correo, telefono, rol, user_active, area, sector, cargo, cedula, pin, telegram_chat_id"
    );
  if (error) {
    console.error("[usuarios] Supabase error:", error);
    return cache ?? [];
  }
  const usuarios = (data as UsuarioDbRow[])
    .map(rowToUsuarioSheet)
    .filter((u): u is UsuarioSheet => u != null);

  cache = usuarios;
  cacheTimestamp = now;
  return usuarios;
}

export function invalidarCacheUsuarios(): void {
  cache = null;
  cacheTimestamp = 0;
}

/** Forma que espera el cliente admin (Correos/UserActive/etc). */
export function usuarioSheetToApiRow(u: UsuarioSheet): Record<string, unknown> {
  return {
    Responsable: u.responsable,
    Correos: u.email,
    Telefono: u.telefono,
    Rol: u.rol,
    UserActive: u.userActive ? "TRUE" : "FALSE",
    Area: u.area,
    Sector: u.sector,
    Cargo: u.cargo,
    Cedula: u.cedula,
    PIN: u.pin,
    TelegramChatId: u.telegram_chat_id ?? "",
  };
}

export async function findUsuarioByEmail(email: string): Promise<UsuarioSheet | null> {
  const norm = normalizeEmailForAuth(email);
  const usuarios = await getUsuariosFromSheet();
  return usuarios.find((u) => u.email === norm) ?? null;
}

export async function findUsuarioByResponsable(nombre: string): Promise<UsuarioSheet | null> {
  const t = nombre.trim().toLowerCase();
  if (!t) return null;
  const usuarios = await getUsuariosFromSheet();
  return usuarios.find((u) => u.responsable.trim().toLowerCase() === t) ?? null;
}

export async function getUsuariosDeZona(sector: string): Promise<UsuarioSheet[]> {
  const usuarios = await getUsuariosFromSheet();
  const canon = sheetSectorToCanon(sector);
  return usuarios.filter((u) => u.sector === canon && u.userActive);
}

export async function responsablesEnZonaSheetSet(sector: string): Promise<Set<string>> {
  const usuarios = await getUsuariosFromSheet();
  const target = sheetSectorToCanon(sector);
  return new Set(
    usuarios
      .filter(
        (u) =>
          u.userActive &&
          (u.rol === "user" || u.rol === "coordinador") &&
          u.sector === target
      )
      .map((u) => u.responsable.trim().toLowerCase())
      .filter(Boolean)
  );
}

export async function getTelefonoDeUsuario(responsable: string): Promise<string | null> {
  const u = await findUsuarioByResponsable(responsable);
  const t = u?.telefono?.trim();
  return t || null;
}

export async function getTelefonosAdmins(): Promise<string[]> {
  const usuarios = await getUsuariosFromSheet();
  return usuarios
    .filter((u) => u.rol === "admin" && u.userActive && u.telefono)
    .map((u) => u.telefono.replace(/[^0-9]/g, ""));
}

export async function getTelefonosCoordinadoresZona(sector: string): Promise<string[]> {
  const usuarios = await getUsuariosFromSheet();
  const canon = sheetSectorToCanon(sector);
  return usuarios
    .filter(
      (u) => u.rol === "coordinador" && u.userActive && u.telefono && u.sector === canon
    )
    .map((u) => u.telefono.replace(/[^0-9]/g, ""));
}
