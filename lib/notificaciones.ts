import {
  findUsuarioByResponsable,
  getUsuariosFromSheet,
  sheetSectorToCanon,
} from "@/lib/usuarios-sheet";

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim() || "";

export function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** URL pública de la app (enlaces en mensajes). */
export function appPublicBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, "");
    return `https://${host}`;
  }
  return "https://micaja3-one.vercel.app";
}

export type TelegramParseMode = "HTML" | "Markdown";
export type TelegramInlineButton = { text: string; callback_data: string };
export type TelegramInlineKeyboard = TelegramInlineButton[][];

export async function enviarTelegram(
  chatId: string,
  mensaje: string,
  opts?: { parse_mode?: TelegramParseMode; reply_markup?: { inline_keyboard: TelegramInlineKeyboard } }
): Promise<{ ok: boolean; messageId?: number }> {
  if (!TELEGRAM_TOKEN || !chatId) return { ok: false };
  const parse_mode = opts?.parse_mode ?? "HTML";
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: mensaje,
        parse_mode,
        disable_web_page_preview: true,
        ...(opts?.reply_markup ? { reply_markup: opts.reply_markup } : {}),
      }),
    });
    if (!res.ok) return { ok: false };
    const j = (await res.json().catch(() => ({}))) as { result?: { message_id?: number } };
    return { ok: true, messageId: j.result?.message_id };
  } catch {
    return { ok: false };
  }
}

export async function editarMensajeTelegram(
  chatId: string,
  messageId: number,
  mensaje: string,
  opts?: { parse_mode?: TelegramParseMode; reply_markup?: { inline_keyboard: TelegramInlineKeyboard } }
): Promise<boolean> {
  if (!TELEGRAM_TOKEN || !chatId) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text: mensaje,
        parse_mode: opts?.parse_mode ?? "HTML",
        disable_web_page_preview: true,
        ...(opts?.reply_markup ? { reply_markup: opts.reply_markup } : {}),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function responderCallbackTelegram(
  callbackQueryId: string,
  text?: string
): Promise<boolean> {
  if (!TELEGRAM_TOKEN) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId, ...(text ? { text } : {}) }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function notificarUsuario(responsable: string, mensajeHtml: string): Promise<boolean> {
  const usuario = await findUsuarioByResponsable(responsable);
  const cid = usuario?.telegram_chat_id?.trim();
  if (!cid) return false;
  const result = await enviarTelegram(cid, mensajeHtml).catch(() => ({ ok: false }));
  return result.ok;
}

export async function notificarAdmins(mensajeHtml: string): Promise<void> {
  const usuarios = await getUsuariosFromSheet();
  const admins = usuarios.filter((u) => u.rol === "admin" && u.userActive && u.telegram_chat_id?.trim());
  for (const admin of admins) {
    void enviarTelegram(admin.telegram_chat_id!.trim(), mensajeHtml).catch(() => {});
  }
}

export async function notificarCoordinadoresZona(sector: string, mensajeHtml: string): Promise<void> {
  const canon = sheetSectorToCanon(sector);
  const usuarios = await getUsuariosFromSheet();
  const coords = usuarios.filter(
    (u) =>
      u.rol === "coordinador" &&
      u.userActive &&
      u.telegram_chat_id?.trim() &&
      u.sector === canon
  );
  for (const coord of coords) {
    void enviarTelegram(coord.telegram_chat_id!.trim(), mensajeHtml).catch(() => {});
  }
}
