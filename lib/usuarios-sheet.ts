import { assertSheetsConfigured, getSheetsClient, SHEET_NAMES, SPREADSHEET_IDS } from "@/lib/google-sheets";
import { normalizeEmailForAuth } from "@/lib/email-normalize";
import { normalizeSector } from "@/lib/sector-normalize";
import { quoteSheetTitleForRange } from "@/lib/sheets-helpers";
import { FALLBACK_USERS } from "@/lib/users-fallback";

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
  /** Columna TelegramChatId en hoja Usuarios */
  telegram_chat_id?: string;
};

let cache: UsuarioSheet[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000;

function usuariosTabName(): string {
  return process.env.USUARIOS_SHEET_NAME?.trim() || SHEET_NAMES.USUARIOS;
}

/** Sector canónico para comparar con `normalizeSector` / sesión. */
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

function headerIndex(headers: string[], ...names: string[]): number {
  const norm = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "");
  const lowered = headers.map((h) => norm(String(h ?? "")));
  for (const name of names) {
    const want = norm(name);
    const i = lowered.findIndex((h) => h === want || h.replace(/_/g, "") === want.replace(/_/g, ""));
    if (i >= 0) return i;
  }
  return -1;
}

function getFallbackUsers(): UsuarioSheet[] {
  return FALLBACK_USERS.map((u) => ({
    responsable: u.responsable,
    email: normalizeEmailForAuth(u.email),
    telefono: (u.telefono || "").replace(/[^0-9]/g, ""),
    rol: u.rol,
    userActive: u.userActive,
    area: u.area,
    sector: sheetSectorToCanon(u.sector),
    cargo: u.cargo,
    cedula: u.cedula || "",
    pin: u.pin || "1234",
    telegram_chat_id: undefined,
  }));
}

export async function getUsuariosFromSheet(): Promise<UsuarioSheet[]> {
  const now = Date.now();
  if (cache && now - cacheTimestamp < CACHE_TTL) return cache;

  const spreadsheetId = SPREADSHEET_IDS.MICAJA.trim();
  if (!spreadsheetId) {
    const fb = getFallbackUsers();
    cache = fb;
    cacheTimestamp = now;
    return fb;
  }

  try {
    assertSheetsConfigured();
    const sheets = getSheetsClient();
    const tab = usuariosTabName();
    const range = `${quoteSheetTitleForRange(tab)}!A:Z`;
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = res.data.values ?? [];
    if (rows.length < 2) {
      const fb = getFallbackUsers();
      cache = fb;
      cacheTimestamp = now;
      return fb;
    }

    const headers = (rows[0] ?? []).map((h) => String(h ?? "").trim());
    const iResp = headerIndex(headers, "Responsable", "Nombre");
    const iEmail = headerIndex(headers, "Correos", "Correo", "Email", "E-mail");
    const iTel = headerIndex(headers, "Telefono", "Teléfono", "Telefono movil");
    const iRol = headerIndex(headers, "Rol", "Role");
    const iActive = headerIndex(headers, "UserActive", "User Active", "Activo");
    const iArea = headerIndex(headers, "Area", "Área");
    const iSector = headerIndex(headers, "Sector", "Zona");
    const iCargo = headerIndex(headers, "Cargo");
    const iCedula = headerIndex(headers, "Cedula", "Cédula", "Documento");
    const iPin = headerIndex(headers, "PIN", "Pin", "pin");
    const iTelegram = headerIndex(headers, "TelegramChatId", "Telegram", "Telegram Chat Id");

    if (iEmail < 0) {
      console.error("[usuarios-sheet] No se encontró columna de correo en Usuarios");
      return getFallbackUsers();
    }

    const usuarios = (rows as string[][]).slice(1)
      .map((r): UsuarioSheet | null => {
        const emailRaw = String(r[iEmail] ?? "").trim();
        if (!emailRaw) return null;

        const activeRaw = String(iActive >= 0 ? r[iActive] ?? "" : "")
          .toUpperCase()
          .trim();
        const rolRaw = String(iRol >= 0 ? r[iRol] ?? "" : "user")
          .toLowerCase()
          .trim();
        const sectorRaw = String(iSector >= 0 ? r[iSector] ?? "" : "").trim();

        const rol: UsuarioSheet["rol"] = ["admin", "coordinador", "user"].includes(rolRaw)
          ? (rolRaw as UsuarioSheet["rol"])
          : "user";

        return {
          responsable: String(iResp >= 0 ? r[iResp] ?? "" : "").trim(),
          email: normalizeEmailForAuth(emailRaw),
          telefono: String(iTel >= 0 ? r[iTel] ?? "" : "")
            .trim()
            .replace(/[^0-9]/g, ""),
          rol,
          userActive:
            iActive < 0
              ? true
              : activeRaw === "TRUE" ||
                activeRaw === "SI" ||
                activeRaw === "SÍ" ||
                activeRaw === "YES" ||
                activeRaw === "1" ||
                activeRaw === "VERDADERO",
          area: String(iArea >= 0 ? r[iArea] ?? "" : "").trim(),
          sector: sheetSectorToCanon(sectorRaw),
          cargo: String(iCargo >= 0 ? r[iCargo] ?? "" : "").trim(),
          cedula: String(iCedula >= 0 ? r[iCedula] ?? "" : "").trim(),
          pin: String(iPin >= 0 ? r[iPin] ?? "" : "1234").trim() || "1234",
          telegram_chat_id: (() => {
            const t = String(iTelegram >= 0 ? r[iTelegram] ?? "" : "").trim();
            return t || undefined;
          })(),
        };
      })
      .filter((u): u is UsuarioSheet => u != null);

    cache = usuarios;
    cacheTimestamp = now;
    return usuarios;
  } catch (e) {
    console.error("[usuarios-sheet] Error leyendo Sheets, usando fallback:", e);
    return getFallbackUsers();
  }
}

export function invalidarCacheUsuarios(): void {
  cache = null;
  cacheTimestamp = 0;
}

/** Fila compatible con admin (`Correos`, `UserActive`, etc.) y `_usuariosSpreadsheetId` para PATCH. */
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
    _usuariosSource: "MICAJA",
    _usuariosSpreadsheetId: SPREADSHEET_IDS.MICAJA.trim(),
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

/** Responsables activos en zona: técnicos y coordinadores (facturas, envíos, filtros API). */
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
