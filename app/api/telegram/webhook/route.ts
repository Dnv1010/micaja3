/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { formatCOP } from "@/lib/format";
import { parseFacturaText, parseGeminiJson } from "@/lib/factura-parser";
import { appPublicBaseUrl, enviarTelegram, escHtml } from "@/lib/notificaciones";
import {
  handleComandoEquipo,
  handleComandoSaldo,
  handleComandoStartHelp,
} from "@/lib/telegram-commands";
import { iniciarFlujGastos, procesarMensajeGastos, getSesionGastos, procesarFotoGasto, deleteSesionGastos } from "@/lib/telegram-gastos";
import { getUsuariosFromSheet } from "@/lib/usuarios-sheet";
import { patchUsuarioTelegramChatId } from "@/lib/usuarios-micaja-crud";
import { runGeminiOcr } from "@/lib/gemini-factura-prompt";

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


async function handleUpdate(req: NextRequest): Promise<NextResponse> {
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

  // callback_query ignorado: ya no usamos botones inline para facturas.
  if (body.callback_query) {
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

  // ── Sesion de gastos activa (texto) ──

  const sesionActiva = await getSesionGastos(chatId);
  if (sesionActiva && texto && !texto.startsWith("/")) {
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



      // --- OCR: Gemini (cadena pro→flash→lite) + OCR.Space texto (fallback) ---
      let datos: ReturnType<typeof parseFacturaText> | null = null;

      const geminiJson = await runGeminiOcr(base64, mimeType);
      if (geminiJson) {
        try {
          datos = parseGeminiJson(geminiJson);
          console.log("[gemini] OK:", JSON.stringify(datos).slice(0, 200));
        } catch (gemErr) {
          console.error("[gemini] parse error:", gemErr);
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

      // >>> PRIORIDAD: solo si el flujo /gastos está esperando una foto
      const sesionGastos2 = await getSesionGastos(chatId);
      if (sesionGastos2 && sesionGastos2.paso === "esperando_foto") {
        await procesarFotoGasto(chatId, datos, imagenUrl);
        return NextResponse.json({ ok: true });
      }

      // >>> Flujo normal caja menor: guarda directo y confirma por chat <
      const monto = datos.monto_factura ?? 0;
      const valorRedondo = Math.max(0, Math.round(monto));
      const ciudadDefault = usuario.sector === "Bogota" ? "Bogot\u00e1" : "Barranquilla";
      const ciudad = datos.ciudad?.trim() || ciudadDefault;

      // Normalizar fecha a DD/MM/YYYY (la validación backend la exige estricta)
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

      const facturaBody = {
        fecha: fechaFinal,
        proveedor,
        nit: datos.nit_factura || "",
        numFactura: datos.num_factura || "",
        concepto,
        valor: String(valorRedondo),
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
      };

      const saveRes = await fetch(`${base}/api/facturas`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-internal-key": internalKey },
        body: JSON.stringify(facturaBody),
      });
      const saveJson = (await saveRes.json().catch(() => ({}))) as { ok?: boolean; error?: string; duplicada?: boolean };
      if (!saveRes.ok || !saveJson.ok) {
        console.error("[telegram save]", saveRes.status, saveJson, "body:", facturaBody);
        await enviarTelegram(
          chatId,
          `\u274c No se pudo guardar: ${escHtml(saveJson.error || "error")}${saveJson.duplicada ? " (posible duplicado)" : ""}`
        );
        return NextResponse.json({ ok: true });
      }

      const valorAviso = valorRedondo <= 0
        ? " \u26a0\ufe0f <i>no detectado, edita en la app</i>"
        : "";
      const resumen = [
        `\u2705 <b>Factura registrada</b>`,
        ``,
        `\ud83e\udd6b Proveedor: ${escHtml(proveedor)}`,
        `\ud83d\udd22 NIT: ${escHtml(datos.nit_factura || "No detectado")}`,
        `\ud83e\uddfe N\u00b0 Factura: ${escHtml(datos.num_factura || "No detectado")}`,
        `\ud83d\udcc5 Fecha: ${escHtml(fechaFinal)}`,
        `\ud83d\udcb0 Valor: ${escHtml(formatCOP(valorRedondo))}${valorAviso}`,
        `\ud83c\udff7\ufe0f A nombre de BIA: ${datos.nombre_bia ? "\u2705 S\u00ed" : "\u274c No"}`,
        ``,
        `<i>Si algo est\u00e1 incorrecto, ed\u00edtala en la app.</i>`,
        `${escHtml(serverBaseUrl())}/facturas`,
      ].join("\n");

      await enviarTelegram(chatId, resumen);
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

/**
 * Envoltura global: Telegram reintenta si devolvemos 5xx. Atrapamos TODO
 * para devolver 200 siempre y loguear el error real en Vercel.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    return await handleUpdate(req);
  } catch (err) {
    console.error("[telegram webhook] unhandled:", err);
    return NextResponse.json({ ok: true, handled: false });
  }
}
