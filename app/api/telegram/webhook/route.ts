/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { formatCOP } from "@/lib/format";
import { parseFacturaText, parseGeminiJson } from "@/lib/factura-parser";
import {
  appPublicBaseUrl,
  enviarTelegram,
  editarMensajeTelegram,
  responderCallbackTelegram,
  escHtml,
} from "@/lib/notificaciones";
import {
  handleComandoEquipo,
  handleComandoSaldo,
  handleComandoStartHelp,
} from "@/lib/telegram-commands";
import { iniciarFlujGastos, procesarMensajeGastos, getSesionGastos, procesarFotoGasto, deleteSesionGastos } from "@/lib/telegram-gastos";
import { getUsuariosFromSheet } from "@/lib/usuarios-sheet";
import { patchUsuarioTelegramChatId } from "@/lib/usuarios-micaja-crud";
import { inferirCategoria, TOPES_COP } from "@/lib/auditor-facturas";
import { getSupabase } from "@/lib/supabase";
import { GEMINI_FACTURA_PROMPT_CORE } from "@/lib/gemini-factura-prompt";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim() || "";

function serverBaseUrl(): string {
  const u = process.env.NEXTAUTH_URL?.trim().replace(/\/$/, "");
  if (u) return u;
  return appPublicBaseUrl();
}

function mimeFromTelegramPath(filePath: string): string {
  const p = filePath.toLowerCase();
  if (p.endsWith(".png")) return "image/png";
  if (p.endsWith(".webp")) return "image/webp";
  if (p.endsWith(".gif")) return "image/gif";
  if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
  return "image/jpeg";
}

function mimeFromDownload(header: string | null, filePath: string): string {
  const main = header?.split(";")[0]?.trim().toLowerCase() || "";
  if (main.startsWith("image/")) return main;
  return mimeFromTelegramPath(filePath);
}

// ── Sesión de factura pendiente (preview antes de guardar) ──
const CONFIRM_STATE = "confirmar_factura";
const EDIT_STATE_PREFIX = "edit_factura:";

type EditField = "valor" | "proveedor" | "nit" | "fecha" | "numFactura" | "concepto";
const EDIT_FIELD_LABELS: Record<EditField, string> = {
  valor: "Valor",
  proveedor: "Proveedor",
  nit: "NIT del proveedor",
  fecha: "Fecha",
  numFactura: "N° de factura",
  concepto: "Concepto",
};

type PendingFactura = {
  fecha: string;
  proveedor: string;
  nit: string;
  numFactura: string;
  concepto: string;
  valor: number;
  tipoFactura: string;
  servicioDeclarado: string;
  tipoOperacion: string;
  aNombreBia: boolean;
  ciudad: string;
  sector: string;
  responsable: string;
  area: string;
  imagenUrl: string;
  driveFileId: string;
  categoria: "desayuno" | "almuerzo" | "cena" | "hospedaje" | "otro";
  tope: number | null;
  excedente: number;
  previewMessageId?: number;
};

async function guardarPendingFactura(chatId: string, responsable: string, data: PendingFactura) {
  const sb = getSupabase();
  await sb.from("sesiones_bot").upsert(
    {
      chat_id: chatId,
      responsable,
      estado: CONFIRM_STATE,
      datos_temp: data,
      ultimo_mensaje: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "chat_id" }
  );
}

async function leerSesionFactura(
  chatId: string
): Promise<{ estado: string; data: PendingFactura } | null> {
  const { data, error } = await getSupabase()
    .from("sesiones_bot")
    .select("estado, datos_temp")
    .eq("chat_id", chatId)
    .limit(1);
  if (error || !data?.length) return null;
  const estado = String(data[0].estado || "");
  if (estado !== CONFIRM_STATE && !estado.startsWith(EDIT_STATE_PREFIX)) return null;
  const dt = data[0].datos_temp as PendingFactura | null;
  if (!dt) return null;
  return { estado, data: dt };
}

async function leerPendingFactura(chatId: string): Promise<PendingFactura | null> {
  const s = await leerSesionFactura(chatId);
  if (!s || s.estado !== CONFIRM_STATE) return null;
  return s.data;
}

async function actualizarEstadoSesion(chatId: string, estado: string, data: PendingFactura) {
  await getSupabase()
    .from("sesiones_bot")
    .upsert(
      {
        chat_id: chatId,
        responsable: data.responsable,
        estado,
        datos_temp: data,
        ultimo_mensaje: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "chat_id" }
    );
}

async function borrarPendingFactura(chatId: string) {
  await getSupabase().from("sesiones_bot").delete().eq("chat_id", chatId);
}

function botonesFactura() {
  return {
    inline_keyboard: [[
      { text: "✅ Confirmar", callback_data: "fact:ok" },
      { text: "✏️ Editar", callback_data: "fact:edit" },
      { text: "❌ Cancelar", callback_data: "fact:cancel" },
    ]],
  };
}

function botonesEditar() {
  return {
    inline_keyboard: [
      [
        { text: "💰 Valor", callback_data: "fact:editf:valor" },
        { text: "🏪 Proveedor", callback_data: "fact:editf:proveedor" },
      ],
      [
        { text: "🔢 NIT", callback_data: "fact:editf:nit" },
        { text: "📅 Fecha", callback_data: "fact:editf:fecha" },
      ],
      [
        { text: "🧾 N° Factura", callback_data: "fact:editf:numFactura" },
        { text: "📝 Concepto", callback_data: "fact:editf:concepto" },
      ],
      [{ text: "⬅️ Volver", callback_data: "fact:back" }],
    ],
  };
}

function normalizarFechaInput(raw: string): string {
  const t = raw.trim();
  const m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    let y = +m[3];
    if (y < 100) y += 2000;
    return `${m[1].padStart(2, "0")}/${m[2].padStart(2, "0")}/${y}`;
  }
  return t;
}

function parseValorInput(raw: string): number | null {
  const s = raw.replace(/[^\d.,]/g, "").replace(/[.,]\d{1,2}$/, "").replace(/[.,]/g, "");
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function recalcularCategoriaYTope(p: PendingFactura): PendingFactura {
  const categoria = inferirCategoria({
    idFactura: "",
    valor: p.valor,
    concepto: p.concepto,
    tipoServicio: p.servicioDeclarado,
    proveedor: p.proveedor,
  });
  const tope = TOPES_COP[categoria];
  const excedente = tope != null && p.valor > tope ? p.valor - tope : 0;
  return { ...p, categoria, tope, excedente };
}

/**
 * Aplica el texto al campo indicado y devuelve el PendingFactura actualizado.
 */
function aplicarEdicion(p: PendingFactura, campo: EditField, texto: string): { ok: boolean; nuevo: PendingFactura; error?: string } {
  const trimmed = texto.trim();
  if (!trimmed) return { ok: false, nuevo: p, error: "Valor vacío" };
  if (campo === "valor") {
    const n = parseValorInput(trimmed);
    if (n == null) return { ok: false, nuevo: p, error: "No entendí el valor. Escribe el monto en pesos, ej: 26500" };
    return { ok: true, nuevo: recalcularCategoriaYTope({ ...p, valor: n }) };
  }
  if (campo === "fecha") {
    return { ok: true, nuevo: { ...p, fecha: normalizarFechaInput(trimmed) } };
  }
  if (campo === "concepto" || campo === "proveedor") {
    return { ok: true, nuevo: recalcularCategoriaYTope({ ...p, [campo]: trimmed.slice(0, 200) }) };
  }
  // nit, numFactura
  return { ok: true, nuevo: { ...p, [campo]: trimmed.slice(0, 40) } };
}

function mensajePreview(p: PendingFactura): string {
  const labelCat: Record<PendingFactura["categoria"], string> = {
    desayuno: "Desayuno",
    almuerzo: "Almuerzo",
    cena: "Cena",
    hospedaje: "Hospedaje",
    otro: "Otro gasto",
  };
  const lines: string[] = [];
  lines.push(`📸 <b>Recibido.</b> Veo que es <b>${labelCat[p.categoria]}</b> por ${escHtml(formatCOP(p.valor))}.`);
  if (p.tope != null) {
    if (p.excedente > 0) {
      lines.push(`⚠️ Te pasaste por <b>${escHtml(formatCOP(p.excedente))}</b> del tope (${escHtml(formatCOP(p.tope))}).`);
    } else {
      lines.push(`✅ Dentro del tope (${escHtml(formatCOP(p.tope))}).`);
    }
  }
  lines.push("");
  lines.push(`🏪 ${escHtml(p.proveedor || "Proveedor por confirmar")}`);
  if (p.nit) lines.push(`🔢 NIT: ${escHtml(p.nit)}`);
  if (p.fecha) lines.push(`📅 ${escHtml(p.fecha)}`);
  lines.push("");
  lines.push("¿Quieres que lo registre así?");
  return lines.join("\n");
}

async function confirmarYGuardarFactura(chatId: string, base: string, internalKey: string): Promise<void> {
  const p = await leerPendingFactura(chatId);
  if (!p) {
    await enviarTelegram(chatId, "ℹ️ No hay factura pendiente.");
    return;
  }
  const body = {
    fecha: p.fecha,
    proveedor: p.proveedor,
    nit: p.nit,
    numFactura: p.numFactura,
    concepto: p.concepto,
    valor: String(Math.max(0, Math.round(p.valor))),
    tipoFactura: p.tipoFactura,
    servicioDeclarado: p.servicioDeclarado,
    tipoOperacion: p.tipoOperacion,
    aNombreBia: p.aNombreBia,
    ciudad: p.ciudad,
    sector: p.sector,
    responsable: p.responsable,
    area: p.area,
    imagenUrl: p.imagenUrl,
    driveFileId: p.driveFileId,
  };
  const saveRes = await fetch(`${base}/api/facturas`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-key": internalKey },
    body: JSON.stringify(body),
  });
  const saveJson = (await saveRes.json().catch(() => ({}))) as { ok?: boolean; error?: string; duplicada?: boolean };
  await borrarPendingFactura(chatId);
  if (!saveRes.ok || !saveJson.ok) {
    console.error("[telegram confirm save]", saveRes.status, saveJson, "body:", body);
    await enviarTelegram(
      chatId,
      `❌ No se pudo guardar: ${escHtml(saveJson.error || "error")}${saveJson.duplicada ? " (posible duplicado)" : ""}`
    );
    return;
  }
  await enviarTelegram(
    chatId,
    `✅ <b>Factura registrada.</b>\n\n🏪 ${escHtml(p.proveedor || "—")}\n💰 ${escHtml(formatCOP(p.valor))}`
  );
}

export async function POST(req: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (secret && req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!TOKEN) {
    return NextResponse.json({ ok: false, error: "Bot no configurado" }, { status: 503 });
  }

  let body: {
    message?: {
      chat?: { id?: number };
      text?: string;
      photo?: { file_id: string }[];
      document?: { file_id?: string; mime_type?: string };
    };
    callback_query?: {
      id: string;
      from?: { id?: number };
      message?: { chat?: { id?: number }; message_id?: number };
      data?: string;
    };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  // ── Callback query (click en botones inline) ──
  if (body.callback_query) {
    const cq = body.callback_query;
    const chatId = String(cq.message?.chat?.id ?? cq.from?.id ?? "");
    const messageId = cq.message?.message_id;
    const dataCq = String(cq.data || "");
    await responderCallbackTelegram(cq.id);
    const internalKey = process.env.INTERNAL_API_KEY?.trim() || "";
    const base = serverBaseUrl();

    if (dataCq === "fact:ok") {
      if (messageId) await editarMensajeTelegram(chatId, messageId, "⏳ Registrando factura…");
      // Fire-and-forget: evita que Vercel timeout congele el botón si loadFacturas es lento.
      void confirmarYGuardarFactura(chatId, base, internalKey).catch((e) => {
        console.error("[confirm bg]", e);
      });
      return NextResponse.json({ ok: true });
    } else if (dataCq === "fact:cancel") {
      await borrarPendingFactura(chatId);
      if (messageId) {
        await editarMensajeTelegram(chatId, messageId, "❌ Factura cancelada. Si fue un error, vuelve a enviar la foto.");
      } else {
        await enviarTelegram(chatId, "❌ Factura cancelada.");
      }
    } else if (dataCq === "fact:edit") {
      const p = await leerPendingFactura(chatId);
      if (!p) {
        await enviarTelegram(chatId, "ℹ️ No hay factura pendiente.");
      } else if (messageId) {
        await editarMensajeTelegram(chatId, messageId, mensajePreview(p) + "\n\n<i>¿Qué quieres cambiar?</i>", {
          reply_markup: botonesEditar(),
        });
      }
    } else if (dataCq === "fact:back") {
      const p = await leerPendingFactura(chatId);
      if (p && messageId) {
        await editarMensajeTelegram(chatId, messageId, mensajePreview(p), { reply_markup: botonesFactura() });
      }
    } else if (dataCq.startsWith("fact:editf:")) {
      const campo = dataCq.slice("fact:editf:".length) as EditField;
      const p = await leerPendingFactura(chatId);
      if (!p) {
        await enviarTelegram(chatId, "ℹ️ No hay factura pendiente.");
      } else if (EDIT_FIELD_LABELS[campo]) {
        await actualizarEstadoSesion(chatId, `${EDIT_STATE_PREFIX}${campo}`, p);
        const ejemplo =
          campo === "valor"
            ? "Ej: 26500"
            : campo === "fecha"
              ? "Ej: 20/04/2026"
              : campo === "nit"
                ? "Ej: 900.123.456-7"
                : "";
        await enviarTelegram(
          chatId,
          `✏️ Escribe el <b>nuevo ${escHtml(EDIT_FIELD_LABELS[campo].toLowerCase())}</b>${ejemplo ? `\n<i>${ejemplo}</i>` : ""}\n\n(o /cancelar para salir de la edición)`
        );
      }
    }
    return NextResponse.json({ ok: true });
  }

  const message = body.message;
  if (!message?.chat?.id) return NextResponse.json({ ok: true });

  const chatId = String(message.chat.id);
  const texto = String(message.text || "").trim();
  const foto = message.photo;
  const documento = message.document;

  const primeraPalabra = texto.split(/\s+/)[0]?.toLowerCase() ?? "";

  // ── Comandos ──

  if (primeraPalabra === "/reporte") {
    const sesionR = await getSesionGastos(chatId);
    if (sesionR) {
      await deleteSesionGastos(chatId);
      await enviarTelegram(chatId, "\u23f3 Generando reporte...");
      const { enviarReporteDirecto, guardarGastosEnSheetPublic } = await import("@/lib/telegram-gastos");
      await guardarGastosEnSheetPublic(sesionR);
      await enviarReporteDirecto(chatId, sesionR);
    } else {
      await enviarTelegram(chatId, "No hay reporte pendiente. Usa /gastos para crear uno.");
    }
    return NextResponse.json({ ok: true });
  }

  if (primeraPalabra === "/cancelar") {
    await deleteSesionGastos(chatId);
    await enviarTelegram(chatId, "\u2705 Sesion cancelada. Escribe /menu para empezar.");
    return NextResponse.json({ ok: true });
  }

  if (texto === "/help" || /^\/start(\s|$)/i.test(texto)) {
    await handleComandoStartHelp(chatId);
    return NextResponse.json({ ok: true });
  }

  if (primeraPalabra === "/menu") {
    await enviarTelegram(chatId, "\ud83d\udc4b <b>MiCaja BIA Energy</b>\n\n\u00bfQu\u00e9 deseas hacer?\n\n1\ufe0f\u20e3 <code>/cajamenor</code> \u2014 Caja Menor\n2\ufe0f\u20e3 <code>/gastos</code> \u2014 Gastos Generales\n3\ufe0f\u20e3 <code>/saldo</code> \u2014 Ver mi saldo\n4\ufe0f\u20e3 <code>/equipo</code> \u2014 Ver equipo (coordinadores)");
    return NextResponse.json({ ok: true });
  }

  if (primeraPalabra === "/gastos") {
    const usuarios2 = await getUsuariosFromSheet();
    const u2 = usuarios2.find((u) => String(u.telegram_chat_id || "").trim() === chatId);
    if (!u2) { await enviarTelegram(chatId, "\u274c No est\u00e1s registrado. Escribe /registro TuNombre"); return NextResponse.json({ ok: true }); }
    const rol2 = String(u2.rol || "").toLowerCase();
    if (rol2 !== "coordinador" && rol2 !== "admin") { await enviarTelegram(chatId, "\u274c Solo coordinadores y administradores pueden usar Gastos Generales."); return NextResponse.json({ ok: true }); }
    await iniciarFlujGastos(chatId, u2);
    return NextResponse.json({ ok: true });
  }

  if (primeraPalabra === "/saldo" || primeraPalabra === "/mi_saldo") {
    await handleComandoSaldo(chatId);
    return NextResponse.json({ ok: true });
  }

  if (primeraPalabra === "/equipo" || primeraPalabra === "/zona") {
    await handleComandoEquipo(chatId);
    return NextResponse.json({ ok: true });
  }

  // ── Edición inline de factura pendiente (texto) ──

  const sesionFactura = await leerSesionFactura(chatId);
  if (sesionFactura && sesionFactura.estado.startsWith(EDIT_STATE_PREFIX) && texto && !texto.startsWith("/")) {
    const campo = sesionFactura.estado.slice(EDIT_STATE_PREFIX.length) as EditField;
    if (EDIT_FIELD_LABELS[campo]) {
      const res = aplicarEdicion(sesionFactura.data, campo, texto);
      if (!res.ok) {
        await enviarTelegram(chatId, `❌ ${escHtml(res.error || "No entendí el valor.")}`);
        return NextResponse.json({ ok: true });
      }
      await actualizarEstadoSesion(chatId, CONFIRM_STATE, res.nuevo);
      await enviarTelegram(
        chatId,
        `✅ <b>${escHtml(EDIT_FIELD_LABELS[campo])}</b> actualizado.\n\n${mensajePreview(res.nuevo)}`,
        { reply_markup: botonesFactura() }
      );
      return NextResponse.json({ ok: true });
    }
  }

  // ── Sesion de gastos activa (texto) ──

  const sesionActiva = await getSesionGastos(chatId);
  if (sesionActiva && sesionActiva.paso && texto && !texto.startsWith("/")) {
    const responsePromise = procesarMensajeGastos(chatId, texto);
    if (sesionActiva.paso === "mas_facturas" && texto === "2") {
      responsePromise.catch(e => console.error("gastos bg:", e));
      return NextResponse.json({ ok: true });
    }
    await responsePromise;
    return NextResponse.json({ ok: true });
  }

  // ── Buscar usuario ──

  const usuarios = await getUsuariosFromSheet();
  const matchChat = (u: (typeof usuarios)[0]) =>
    String(u.telegram_chat_id || "").trim() === chatId;
  let usuario = usuarios.find(matchChat);

  // /registro
  if (!usuario && /^\/registro\s+/i.test(texto)) {
    const nombre = texto.replace(/^\/registro\s+/i, "").trim();
    if (nombre.length >= 2) {
      const candidato = usuarios.find(
        (u) =>
          u.userActive &&
          u.responsable.toLowerCase().includes(nombre.toLowerCase())
      );
      if (candidato?.email) {
        const ok = await patchUsuarioTelegramChatId(candidato.email, chatId);
        if (ok) {
          usuario = { ...candidato, telegram_chat_id: chatId };
          await enviarTelegram(
            chatId,
            `\u2705 <b>Registro exitoso.</b> Hola ${escHtml(candidato.responsable)} \u2014 ya puedes enviar fotos de facturas.`
          );
          return NextResponse.json({ ok: true });
        }
      }
    }
    await enviarTelegram(
      chatId,
      "\u274c No encontr\u00e9 un usuario activo con ese nombre. Prueba con tu nombre como aparece en MiCaja."
    );
    return NextResponse.json({ ok: true });
  }

  if (!usuario) {
    await enviarTelegram(
      chatId,
      "\u274c Tu Telegram no est\u00e1 registrado en MiCaja.\nEscribe <code>/registro Tu Nombre</code> (como en la app) o pide a tu coordinador que agregue tu <b>TelegramChatId</b> en la hoja Usuarios."
    );
    return NextResponse.json({ ok: true });
  }

  // ── Foto / Imagen ──

  const esImagenDoc =
    documento?.mime_type?.startsWith("image/") && documento.file_id;
  if (foto?.length || esImagenDoc) {
    await enviarTelegram(chatId, "\ud83d\udcf8 Recib\u00ed tu factura, analizando\u2026");

    const internalKey = process.env.INTERNAL_API_KEY?.trim() || "";
    if (!internalKey) {
      await enviarTelegram(chatId, "\u274c Servidor sin INTERNAL_API_KEY \u2014 contacta al administrador.");
      return NextResponse.json({ ok: true });
    }

    try {
      const fileId = foto?.length ? foto[foto.length - 1].file_id : documento!.file_id!;
      const fileRes = await fetch(
        `https://api.telegram.org/bot${TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`
      );
      const fileData = (await fileRes.json()) as { result?: { file_path?: string } };
      const filePath = fileData.result?.file_path;
      if (!filePath) throw new Error("No se pudo obtener la ruta del archivo");

      const fileUrl = `https://api.telegram.org/file/bot${TOKEN}/${filePath}`;
      const imgRes = await fetch(fileUrl);
      if (!imgRes.ok) throw new Error("No se pudo descargar la imagen de Telegram");

      const imgBuffer = await imgRes.arrayBuffer();
      const base64 = Buffer.from(imgBuffer).toString("base64");
      const mimeType = mimeFromDownload(imgRes.headers.get("content-type"), filePath);
      const base64DataUrl = `data:${mimeType};base64,${base64}`;



      // --- OCR: Gemini JSON (primario) + OCR.Space texto (fallback) ---
      let datos: ReturnType<typeof parseFacturaText> | null = null;

      const geminiKey = process.env.GEMINI_API_KEY?.trim();
      if (geminiKey) {
        try {
          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiKey)}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{
                  parts: [
                    { inline_data: { mime_type: mimeType, data: base64 } },
                    { text: GEMINI_FACTURA_PROMPT_CORE },
                  ],
                }],
                generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
              }),
            }
          );
          const geminiData = (await geminiRes.json()) as {
            candidates?: { content?: { parts?: { text?: string }[] } }[];
          };
          const geminiText = geminiData.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text?.trim() || "";
          if (geminiText) {
            // Limpiar markdown si Gemini lo envuelve en backticks
            const cleanJson = geminiText.replace(/```json\n?/g, "").replace(/```/g, "").trim();
            datos = parseGeminiJson(cleanJson);
            console.log("[gemini] OK:", JSON.stringify(datos).slice(0, 200));
          }
        } catch (gemErr) {
          console.error("[gemini] Error:", gemErr);
          datos = null;
        }
      }

      // Fallback: OCR.Space + regex
      if (!datos || (!datos.monto_factura && !datos.razon_social)) {
        let textoOCR = "";
        try {
          const ocrForm = new FormData();
          ocrForm.append("base64Image", base64DataUrl);
          ocrForm.append("apikey", process.env.OCR_SPACE_API_KEY || "helloworld");
          ocrForm.append("language", "spa");
          ocrForm.append("isOverlayRequired", "false");
          ocrForm.append("OCREngine", "2");
          const ocrRes = await fetch("https://api.ocr.space/parse/image", { method: "POST", body: ocrForm });
          const ocrData = (await ocrRes.json()) as { IsErrored?: boolean; ParsedResults?: { ParsedText?: string }[] };
          if (!ocrData.IsErrored && ocrData.ParsedResults?.[0]?.ParsedText) {
            textoOCR = String(ocrData.ParsedResults[0].ParsedText);
          }
        } catch { textoOCR = ""; }
        if (textoOCR.trim().length >= 10) {
          datos = parseFacturaText(textoOCR);
        }
      }

      if (!datos || (!datos.monto_factura && !datos.razon_social && !datos.nit_factura)) {
        const appUrl = escHtml(`${serverBaseUrl()}/facturas/nueva`);
        await enviarTelegram(chatId, "\u274c No pude leer la factura.\n\n\ud83d\udca1 Consejos:\n\u00b7 Imagen bien iluminada\n\u00b7 Sin sombras\n\u00b7 Foto enfocada\n\nO sube en la app: " + appUrl);
        return NextResponse.json({ ok: true });
      }


      const ext =
        mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";
      const imgBlob = new Blob([imgBuffer], { type: mimeType });
      const formData = new FormData();
      formData.append("file", imgBlob, `telegram_${Date.now()}.${ext}`);
      formData.append("sector", usuario.sector);
      formData.append("responsable", usuario.responsable);
      formData.append("fecha", new Date().toISOString().slice(0, 7));

      const base = serverBaseUrl();
      let imagenUrl = "";
      let driveFileId = "";
      try {
        const uploadRes = await fetch(`${base}/api/facturas/upload`, {
          method: "POST",
          body: formData,
          headers: {
            "x-telegram-internal": "true",
            "x-internal-key": internalKey,
          },
        });
        if (uploadRes.ok) {
          const uploadData = (await uploadRes.json()) as { url?: string; fileId?: string };
          imagenUrl = uploadData.url || "";
          driveFileId = uploadData.fileId || "";
        }
      } catch {
        /* continuar sin imagen en Drive */
      }

      if (!imagenUrl) {
        await enviarTelegram(
          chatId,
          "\u274c No se pudo subir la imagen a Drive. Intenta de nuevo m\u00e1s tarde o usa la app."
        );
        return NextResponse.json({ ok: true });
      }

      // >>> PRIORIDAD: Si hay sesion de gastos activa, va a gastos <
      const sesionGastos2 = await getSesionGastos(chatId);
      if (sesionGastos2) {
        await procesarFotoGasto(chatId, datos, imagenUrl);
        return NextResponse.json({ ok: true });
      }

      // >>> Flujo normal caja menor: mostrar preview + botones (no guardar todavía) <
      const monto = datos.monto_factura ?? 0;
      const valorRedondo = Math.max(0, Math.round(monto));
      const ciudadDefault = usuario.sector === "Bogota" ? "Bogot\u00e1" : "Barranquilla";
      const ciudad = datos.ciudad?.trim() || ciudadDefault;

      // Normalizar fecha a DD/MM/YYYY (la validación del backend la exige estricta).
      const fechaCruda = datos.fecha_factura?.trim() || "";
      let fechaFinal = "";
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(fechaCruda)) {
        const [d, m, y] = fechaCruda.split("/");
        fechaFinal = `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(fechaCruda)) {
        const [y, m, d] = fechaCruda.split("-");
        fechaFinal = `${d}/${m}/${y}`;
      } else if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(fechaCruda)) {
        const [d, m, y] = fechaCruda.split("-");
        fechaFinal = `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
      } else {
        const hoy = new Date();
        fechaFinal = `${String(hoy.getDate()).padStart(2, "0")}/${String(hoy.getMonth() + 1).padStart(2, "0")}/${hoy.getFullYear()}`;
      }

      const proveedor = (datos.razon_social || "").trim() || "Proveedor sin identificar";
      const concepto = (datos.descripcion || "").trim() || (datos.servicio_declarado || "").trim() || "Gasto operativo";

      const categoria = inferirCategoria({
        idFactura: "",
        valor: valorRedondo,
        concepto,
        tipoServicio: datos.servicio_declarado ?? "",
        proveedor,
      });
      const tope = TOPES_COP[categoria];
      const excedente = tope != null && valorRedondo > tope ? valorRedondo - tope : 0;

      const pending: PendingFactura = {
        fecha: fechaFinal,
        proveedor,
        nit: datos.nit_factura || "",
        numFactura: datos.num_factura || "",
        concepto,
        valor: valorRedondo,
        tipoFactura: datos.tipo_factura || "POS",
        servicioDeclarado: datos.servicio_declarado || "Otro",
        tipoOperacion: "OPS - Activaciones",
        aNombreBia: !!(datos.nombre_bia && datos.nit_factura),
        ciudad,
        sector: usuario.sector,
        responsable: usuario.responsable,
        area: usuario.area,
        imagenUrl,
        driveFileId,
        categoria,
        tope,
        excedente,
      };

      await guardarPendingFactura(chatId, usuario.responsable, pending);
      await enviarTelegram(chatId, mensajePreview(pending), { reply_markup: botonesFactura() });
    } catch (e) {
      console.error("[telegram webhook]", e);
      await enviarTelegram(
        chatId,
        `\u274c Error procesando la factura. Intenta de nuevo o s\u00fabela desde la app:\n${escHtml(serverBaseUrl())}/facturas/nueva`
      );
    }

    return NextResponse.json({ ok: true });
  }

  await enviarTelegram(
    chatId,
    "\ud83d\udcf8 Env\u00eda una <b>foto</b> de tu factura para registrarla.\n\nComandos: /start \u00b7 /help \u00b7 /saldo \u00b7 /equipo \u00b7 <code>/registro Tu Nombre</code>"
  );
  return NextResponse.json({ ok: true });
}
