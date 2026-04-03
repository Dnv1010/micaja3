import { NextRequest, NextResponse } from "next/server";
import { formatCOP } from "@/lib/format";
import { runOcrSpace } from "@/lib/ocr-space";
import { appPublicBaseUrl, enviarTelegram, escHtml } from "@/lib/notificaciones";
import { getUsuariosFromSheet } from "@/lib/usuarios-sheet";
import { patchUsuarioTelegramChatId } from "@/lib/usuarios-micaja-crud";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim() || "";

function serverBaseUrl(): string {
  const u = process.env.NEXTAUTH_URL?.trim().replace(/\/$/, "");
  if (u) return u;
  return appPublicBaseUrl();
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

  if (texto === "/start" || texto.toLowerCase().startsWith("/start")) {
    await enviarTelegram(
      chatId,
      `👋 Hola <b>${escHtml(usuario.responsable)}</b>\n\nBienvenido a <b>MiCaja BIA Energy</b>.\n\nEnvía una <b>foto</b> de tu factura y la procesamos con OCR. 📸`
    );
    return NextResponse.json({ ok: true });
  }

  if (texto === "/saldo") {
    await enviarTelegram(
      chatId,
      `💰 Consulta tu saldo y movimientos en la app:\n${escHtml(serverBaseUrl())}/mi-cuenta`
    );
    return NextResponse.json({ ok: true });
  }

  const esImagenDoc =
    documento?.mime_type?.startsWith("image/") && documento.file_id;
  if (foto?.length || esImagenDoc) {
    await enviarTelegram(chatId, "📸 Recibí tu factura, procesando…");

    try {
      const fileId = foto?.length ? foto[foto.length - 1].file_id : documento!.file_id!;
      const fileRes = await fetch(`https://api.telegram.org/bot${TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`);
      const fileData = (await fileRes.json()) as { result?: { file_path?: string } };
      const filePath = fileData.result?.file_path;
      if (!filePath) throw new Error("Sin file_path");
      const fileUrl = `https://api.telegram.org/file/bot${TOKEN}/${filePath}`;

      const ocr = await runOcrSpace({ imageUrl: fileUrl });
      if (ocr.isErrored || !ocr.fullText.trim()) {
        await enviarTelegram(
          chatId,
          `❌ No se pudo leer el texto de la imagen${ocr.errorMessage ? `: ${escHtml(ocr.errorMessage)}` : ""}. Intenta otra foto o sube desde la app.`
        );
        return NextResponse.json({ ok: true });
      }

      const datos = ocr.extracted;
      const internalKey = process.env.INTERNAL_API_KEY?.trim() || "";
      if (!internalKey) {
        await enviarTelegram(chatId, "❌ Servidor sin INTERNAL_API_KEY — contacta al administrador.");
        return NextResponse.json({ ok: true });
      }

      const imgRes = await fetch(fileUrl);
      const imgBuffer = await imgRes.arrayBuffer();
      const ext = filePath.toLowerCase().endsWith(".png") ? "png" : "jpg";
      const imgBlob = new Blob([imgBuffer], { type: ext === "png" ? "image/png" : "image/jpeg" });

      const formData = new FormData();
      formData.append("file", imgBlob, `telegram_${Date.now()}.${ext}`);
      formData.append("sector", usuario.sector);
      formData.append("responsable", usuario.responsable);
      formData.append("fecha", new Date().toISOString().slice(0, 7));

      const base = serverBaseUrl();
      const uploadRes = await fetch(`${base}/api/facturas/upload-internal`, {
        method: "POST",
        body: formData,
        headers: { "x-internal-key": internalKey },
      });
      const uploadData = (await uploadRes.json()) as { url?: string; fileId?: string; error?: string };
      if (!uploadRes.ok || !uploadData.url) {
        await enviarTelegram(
          chatId,
          `❌ Error al subir imagen: ${escHtml(uploadData.error || "desconocido")}`
        );
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
        imagenUrl: uploadData.url,
        driveFileId: uploadData.fileId || "",
      };

      const saveRes = await fetch(`${base}/api/facturas-internal`, {
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
        `🔢 NIT: ${escHtml(datos.nit_factura || "—")}`,
        `📅 Fecha: ${escHtml(datos.fecha_factura || "—")}`,
        `💰 Valor: ${escHtml(formatCOP(Math.max(0, Math.round(monto))))}`,
        `🏷️ A nombre BIA: ${datos.nombre_bia ? "✅ Sí" : "❌ No"}`,
        ``,
        `<i>Si algo falla, edítala en la app.</i>`,
        `${escHtml(serverBaseUrl())}/facturas`,
      ].join("\n");

      await enviarTelegram(chatId, resumen);
    } catch (e) {
      console.error("[telegram webhook]", e);
      await enviarTelegram(
        chatId,
        "❌ Error procesando la factura. Intenta de nuevo o súbela desde la app."
      );
    }

    return NextResponse.json({ ok: true });
  }

  await enviarTelegram(
    chatId,
    "📸 Envía una <b>foto</b> de tu factura para registrarla.\n\nComandos: /start · /saldo · <code>/registro Tu Nombre</code>"
  );
  return NextResponse.json({ ok: true });
}
