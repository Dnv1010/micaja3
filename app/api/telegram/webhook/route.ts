import { NextRequest, NextResponse } from "next/server";
import { formatCOP } from "@/lib/format";
import { parseFacturaText } from "@/lib/factura-parser";
import { appPublicBaseUrl, enviarTelegram, escHtml } from "@/lib/notificaciones";
import {
  handleComandoEquipo,
  handleComandoSaldo,
  handleComandoStartHelp,
} from "@/lib/telegram-commands";
import { iniciarFlujGastos, procesarMensajeGastos, getSesionGastos, procesarFotoGasto } from "@/lib/telegram-gastos";
import { getUsuariosFromSheet } from "@/lib/usuarios-sheet";
import { patchUsuarioTelegramChatId } from "@/lib/usuarios-micaja-crud";

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
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const message = body.message;
  if (!message?.chat?.id) return NextResponse.json({ ok: true });

  const chatId = String(message.chat.id);
  const texto = String(message.text || "").trim();
  const foto = message.photo;
  const documento = message.document;

  const primeraPalabra = texto.split(/\s+/)[0]?.toLowerCase() ?? "";

  if (texto === "/help" || /^\/start(\s|$)/i.test(texto)) {
    await handleComandoStartHelp(chatId);
    return NextResponse.json({ ok: true });
  }

  if (primeraPalabra === "/menu") {
    await enviarTelegram(chatId, "👋 <b>MiCaja BIA Energy</b>\n\n¿Qué deseas hacer?\n\n1️⃣ <code>/cajamenor</code> — Caja Menor\n2️⃣ <code>/gastos</code> — Gastos Generales\n3️⃣ <code>/saldo</code> — Ver mi saldo\n4️⃣ <code>/equipo</code> — Ver equipo (coordinadores)");
    return NextResponse.json({ ok: true });
  }
  if (primeraPalabra === "/gastos") {
    const usuarios2 = await getUsuariosFromSheet();
    const u2 = usuarios2.find((u) => String(u.telegram_chat_id || "").trim() === chatId);
    if (!u2) { await enviarTelegram(chatId, "❌ No estás registrado. Escribe /registro TuNombre"); return NextResponse.json({ ok: true }); }
    const rol2 = String(u2.rol || "").toLowerCase();
    if (rol2 !== "coordinador" && rol2 !== "admin") { await enviarTelegram(chatId, "❌ Solo coordinadores y administradores pueden usar Gastos Generales."); return NextResponse.json({ ok: true }); }
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

  // Respuesta al menu
  
  // Procesar sesion de gastos activa
  const sesionActiva = await getSesionGastos(chatId);
  if (sesionActiva && texto && !texto.startsWith("/")) {
    await procesarMensajeGastos(chatId, texto);
    return NextResponse.json({ ok: true });
  }





  const usuarios = await getUsuariosFromSheet();

  const matchChat = (u: (typeof usuarios)[0]) =>
    String(u.telegram_chat_id || "").trim() === chatId;

  let usuario = usuarios.find(matchChat);

  // /registro Nombre Apellido — vincular chat a fila Usuarios por nombre aproximado
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
            `✅ <b>Registro exitoso.</b> Hola ${escHtml(candidato.responsable)} — ya puedes enviar fotos de facturas.`
          );
          return NextResponse.json({ ok: true });
        }
      }
    }
    await enviarTelegram(
      chatId,
      "❌ No encontré un usuario activo con ese nombre. Prueba con tu nombre como aparece en MiCaja."
    );
    return NextResponse.json({ ok: true });
  }

  if (!usuario) {
    await enviarTelegram(
      chatId,
      "❌ Tu Telegram no está registrado en MiCaja.\nEscribe <code>/registro Tu Nombre</code> (como en la app) o pide a tu coordinador que agregue tu <b>TelegramChatId</b> en la hoja Usuarios."
    );
    return NextResponse.json({ ok: true });
  }

  const esImagenDoc =
    documento?.mime_type?.startsWith("image/") && documento.file_id;
  if (foto?.length || esImagenDoc) {
    await enviarTelegram(chatId, "📸 Recibí tu factura, analizando…");

    const internalKey = process.env.INTERNAL_API_KEY?.trim() || "";
    if (!internalKey) {
      await enviarTelegram(chatId, "❌ Servidor sin INTERNAL_API_KEY — contacta al administrador.");
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

      let textoOCR = "";
      try {
        const ocrForm = new FormData();
        ocrForm.append("base64Image", base64DataUrl);
        ocrForm.append("apikey", process.env.OCR_SPACE_API_KEY || "helloworld");
        ocrForm.append("language", "spa");
        ocrForm.append("isOverlayRequired", "false");
        ocrForm.append("OCREngine", "2");

        const ocrRes = await fetch("https://api.ocr.space/parse/image", {
          method: "POST",
          body: ocrForm,
        });
        const ocrData = (await ocrRes.json()) as {
          IsErrored?: boolean;
          ParsedResults?: { ParsedText?: string }[];
          ErrorMessage?: string | string[];
        };
        if (!ocrData.IsErrored && ocrData.ParsedResults?.[0]?.ParsedText) {
          textoOCR = String(ocrData.ParsedResults[0].ParsedText);
        }
      } catch {
        textoOCR = "";
      }

      if (!textoOCR.trim() || textoOCR.trim().length < 20) {
        const geminiKey = process.env.GEMINI_API_KEY?.trim();
        if (geminiKey) {
          try {
            const geminiRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(geminiKey)}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  contents: [
                    {
                      parts: [
                        {
                          inline_data: {
                            mime_type: mimeType,
                            data: base64,
                          },
                        },
                        {
                          text: "Extrae el texto completo de esta factura colombiana. Incluye: NIT, razón social, número de factura, fecha, valor total, y cualquier otro dato visible. Responde solo con el texto extraído, sin explicaciones.",
                        },
                      ],
                    },
                  ],
                  generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
                }),
              }
            );
            const geminiData = (await geminiRes.json()) as {
              candidates?: { content?: { parts?: { text?: string }[] } }[];
            };
            textoOCR =
              geminiData.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text?.trim() || "";
          } catch {
            textoOCR = "";
          }
        }
      }

      if (!textoOCR.trim() || textoOCR.trim().length < 10) {
        const appUrl = escHtml(`${serverBaseUrl()}/facturas/nueva`);
        await enviarTelegram(
          chatId,
          [
            "❌ No pude leer el texto de la factura.",
            "",
            "💡 <b>Consejos:</b>",
            "· Imagen bien iluminada",
            "· Sin sombras ni reflejos",
            "· Foto enfocada",
            "",
            `O sube la factura en la app: ${appUrl}`,
          ].join("\n")
        );
        return NextResponse.json({ ok: true });
      }

      const datos = parseFacturaText(textoOCR);

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
          "❌ No se pudo subir la imagen a Drive. Intenta de nuevo más tarde o usa la app."
        );
        return NextResponse.json({ ok: true });
      }

      // Si hay sesion de gastos activa, guardar en gastos en vez de caja menor
      const sesionGastos2 = await getSesionGastos(chatId);
      if (sesionGastos2) {
        await procesarFotoGasto(chatId, datos, imagenUrl);
        return NextResponse.json({ ok: true });
      }

      const monto = datos.monto_factura ?? 0;
      const ciudadDefault = usuario.sector === "Bogota" ? "Bogotá" : "Barranquilla";
      const ciudad = datos.ciudad?.trim() || ciudadDefault;

      const facturaBody = {
        fecha: datos.fecha_factura || new Date().toLocaleDateString("es-CO"),
        proveedor: datos.razon_social || "Por confirmar",
        nit: datos.nit_factura || "",
        numFactura: datos.num_factura || "",
        concepto: datos.descripcion || "",
        valor: String(Math.max(0, Math.round(monto))),
        tipoFactura: datos.tipo_factura || "POS",
        servicioDeclarado: datos.servicio_declarado || "Otro",
        tipoOperacion: "OPS - Activaciones",
        aNombreBia: datos.nombre_bia,
        ciudad,
        sector: usuario.sector,
        responsable: usuario.responsable,
        area: usuario.area,
        imagenUrl,
        driveFileId,
      };

      const saveRes = await fetch(`${base}/api/facturas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-key": internalKey,
        },
        body: JSON.stringify(facturaBody),
      });
      const saveJson = (await saveRes.json()) as { ok?: boolean; error?: string; duplicada?: boolean };

      if (!saveRes.ok || !saveJson.ok) {
        await enviarTelegram(
          chatId,
          `❌ No se pudo guardar: ${escHtml(saveJson.error || "error")}${saveJson.duplicada ? " (posible duplicado)" : ""}`
        );
        return NextResponse.json({ ok: true });
      }

      const resumen = [
        `✅ <b>Factura registrada</b>`,
        ``,
        `🏪 Proveedor: ${escHtml(datos.razon_social || "No detectado")}`,
        `🔢 NIT: ${escHtml(datos.nit_factura || "No detectado")}`,
        `🧾 N° Factura: ${escHtml(datos.num_factura || "No detectado")}`,
        `📅 Fecha: ${escHtml(datos.fecha_factura || "No detectada")}`,
        `💰 Valor: ${escHtml(formatCOP(Math.max(0, Math.round(monto))))}`,
        `🏷️ A nombre de BIA: ${datos.nombre_bia ? "✅ Sí" : "❌ No"}`,
        ``,
        `<i>Si algo está incorrecto, edítala en la app.</i>`,
        `${escHtml(serverBaseUrl())}/facturas`,
      ].join("\n");

      await enviarTelegram(chatId, resumen);
    } catch (e) {
      console.error("[telegram webhook]", e);
      await enviarTelegram(
        chatId,
        `❌ Error procesando la factura. Intenta de nuevo o súbela desde la app:\n${escHtml(serverBaseUrl())}/facturas/nueva`
      );
    }

    return NextResponse.json({ ok: true });
  }

  await enviarTelegram(
    chatId,
    "📸 Envía una <b>foto</b> de tu factura para registrarla.\n\nComandos: /start · /help · /saldo · /equipo · <code>/registro Tu Nombre</code>"
  );
  return NextResponse.json({ ok: true });
}
