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

  // -- Comandos --

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

  // -- Sesion de gastos activa (texto) --

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

  // -- Buscar usuario --

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

  // -- Foto / Imagen --

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
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(geminiKey)}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{
                  parts: [
                    { inline_data: { mime_type: mimeType, data: base64 } },
                    { text: "Analiza esta factura colombiana y extrae datos en JSON.\n\nREGLAS CRITICAS:\n1. \"Factura electrónica de venta\", \"Factura de venta\", \"Documento equivalente\", \"Ticket POS\" son TIPOS DE DOCUMENTO — NUNCA son el proveedor.\n2. El PROVEEDOR es la empresa que VENDE: su nombre está cerca del logo, arriba a la izquierda o centro, usualmente con S.A.S, LTDA, S.A., E.S.P., o nombre comercial.\n3. BIA ENERGY S.A.S. ESP (NIT 901588412 o 901588413) es SIEMPRE el CLIENTE/COMPRADOR, NUNCA el proveedor.\n4. El NIT del proveedor está cerca de su nombre/logo, con formato XXXXXXXX-X. NUNCA retornes 901588412 ni 901588413 como NIT.\n5. Si no puedes identificar claramente el proveedor o NIT, retorna \"\" en esos campos.\n\nCampos a extraer:\n- proveedor: Nombre comercial o razón social del VENDEDOR (no el tipo de documento).\n- nit: NIT del VENDEDOR. Excluir NITs de BIA.\n- numero_factura: Número de factura (prefijos: FE, FV, FEHU, POS, No., #)\n- fecha: DD/MM/YYYY\n- valor: Total a pagar en pesos entero. Puntos y comas son miles (41.000=41000)\n- a_nombre_de_bia: true si BIA Energy aparece como cliente\n- ciudad: Ciudad visible\n- tipo_factura: Electronica/POS/Equivalente/Talonario/null\n- servicio: Parqueadero/Peajes/Gasolina/Alimentacion/Hospedaje/Transporte/Lavadero/Llantera/Papeleria/Pago a proveedores/null\n- descripcion: Concepto del servicio.\n\nJSON: {\"proveedor\":\"\",\"nit\":\"\",\"numero_factura\":\"\",\"fecha\":\"\",\"valor\":0,\"a_nombre_de_bia\":false,\"ciudad\":\"\",\"tipo_factura\":\"\",\"servicio\":\"\",\"descripcion\":\"\"} En una factura hay DOS partes:\n1. PROVEEDOR/VENDEDOR: aparece ARRIBA, cerca del logo, con su nombre grande y su NIT. Es quien VENDE.\n2. CLIENTE/COMPRADOR: aparece en campos como Senores, Cliente, Razon Social del cliente. En este caso SIEMPRE es BIA Energy.\n\nBIA ENERGY S.A.S. ESP (NIT 901588412 o 901588413) es SIEMPRE el CLIENTE, NUNCA el proveedor.\n\nCampos:\n- proveedor: Nombre/razon social del VENDEDOR (arriba, logo). NUNCA BIA Energy.\n- nit: NIT del VENDEDOR (cerca de su nombre arriba). NUNCA 901588412 ni 901588413.\n- numero_factura: Numero de factura (FE, FV, Venta, No., N).\n- fecha: DD/MM/YYYY\n- valor: Total a pagar en pesos enteros. Puntos y comas son miles (7.200=7200).\n- a_nombre_de_bia: true si BIA Energy aparece como cliente.\n- ciudad: Ciudad visible.\n- tipo_factura: Electronica/POS/Equivalente/Talonario/null\n- servicio: Parqueadero/Peajes/Gasolina/Alimentacion/Hospedaje/Transporte/Lavadero/Llantera/Papeleria/Pago a proveedores/null\n- descripcion: Concepto.\n\nJSON: {\"proveedor\":\"\",\"nit\":\"\",\"numero_factura\":\"\",\"fecha\":\"\",\"valor\":0,\"a_nombre_de_bia\":false,\"ciudad\":\"\",\"tipo_factura\":\"\",\"servicio\":\"\",\"descripcion\":\"\"}" },
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

      // >>> Flujo normal caja menor <
      const monto = datos.monto_factura ?? 0;
      const ciudadDefault = usuario.sector === "Bogota" ? "Bogot\u00e1" : "Barranquilla";
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
        aNombreBia: datos.nombre_bia && !!datos.nit_factura,
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
          `\u274c No se pudo guardar: ${escHtml(saveJson.error || "error")}${saveJson.duplicada ? " (posible duplicado)" : ""}`
        );
        return NextResponse.json({ ok: true });
      }

      const resumen = [
        `\u2705 <b>Factura registrada</b>`,
        ``,
        `\ud83e\udd6b Proveedor: ${escHtml(datos.razon_social || "No detectado")}`,
        `\ud83d\udd22 NIT: ${escHtml(datos.nit_factura || "No detectado")}`,
        `\ud83e\uddfe N\u00b0 Factura: ${escHtml(datos.num_factura || "No detectado")}`,
        `\ud83d\udcc5 Fecha: ${escHtml(datos.fecha_factura || "No detectada")}`,
        `\ud83d\udcb0 Valor: ${escHtml(formatCOP(Math.max(0, Math.round(monto))))}`,
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
