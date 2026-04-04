/* eslint-disable @typescript-eslint/no-explicit-any */
import { enviarTelegram, escHtml } from "@/lib/notificaciones";
import { formatCOP } from "@/lib/format";
import { appendSheetRow, getSheetData, updateSheetRow, deleteSheetRow, getSheetId } from "@/lib/sheets-helpers";
import { Resend } from "resend";

const SHEET_SESIONES = "Sesiones_Bot";

async function leerSesion(chatId: string): Promise<any | null> {
  try {
    const rows = await getSheetData("MICAJA", SHEET_SESIONES);
    if (rows.length < 2) return null;
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0] || "").trim() === chatId) {
        try { return JSON.parse(rows[i][1] || "null"); } catch { return null; }
      }
    }
    return null;
  } catch { return null; }
}

async function guardarSesion(chatId: string, data: any): Promise<void> {
  try {
    const rows = await getSheetData("MICAJA", SHEET_SESIONES);
    const json = JSON.stringify(data);
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0] || "").trim() === chatId) {
        await updateSheetRow("MICAJA", SHEET_SESIONES, i + 1, [chatId, json]);
        return;
      }
    }
    await appendSheetRow("MICAJA", SHEET_SESIONES, [chatId, json]);
  } catch(e) { console.error("guardarSesion:", e); }
}

async function borrarSesion(chatId: string): Promise<void> {
  try {
    const rows = await getSheetData("MICAJA", SHEET_SESIONES);
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0] || "").trim() === chatId) {
        const sheetId = await getSheetId("MICAJA", SHEET_SESIONES);
        if (sheetId !== null) await deleteSheetRow("MICAJA", SHEET_SESIONES, sheetId, i);
        return;
      }
    }
  } catch(e) { console.error("borrarSesion:", e); }
}

export async function deleteSesionGastos(chatId: string): Promise<void> { await borrarSesion(chatId); }

export async function getSesionGastos(chatId: string): Promise<any | null> {
  return leerSesion(chatId);
}

export async function iniciarFlujGastos(chatId: string, usuario: any): Promise<void> {
  const sesion = { paso: "ciudad", nombre: usuario.responsable || "", cargo: usuario.cargo || "", cc: usuario.cedula || "", facturas: [] };
  await guardarSesion(chatId, sesion);
  await enviarTelegram(chatId, "📋 <b>Legalizacion de Gastos Generales</b>\n\nEscribe la <b>ciudad</b> del gasto:");
}

export async function procesarFotoGasto(chatId: string, datosOCR: any, imagenUrl: string): Promise<void> {
  const s = await leerSesion(chatId);
  if (!s) return;
  s.facturaActual = {
    concepto: datosOCR.descripcion || datosOCR.razon_social || "",
    nit: datosOCR.nit_factura || "",
    fecha: datosOCR.fecha_factura || new Date().toLocaleDateString("es-CO"),
    valor: String(Math.max(0, Math.round(datosOCR.monto_factura ?? 0))),
    urlImagen: imagenUrl,
    centroCostos: "",
  };
  s.paso = "editar_datos";
  await guardarSesion(chatId, s);
  await enviarTelegram(chatId,
    "📄 <b>Datos extraidos:</b>\n" +
    "Concepto: <b>" + escHtml(s.facturaActual.concepto || "No detectado") + "</b>\n" +
    "NIT: <b>" + escHtml(s.facturaActual.nit || "No detectado") + "</b>\n" +
    "Fecha: <b>" + escHtml(s.facturaActual.fecha) + "</b>\n" +
    "Valor: <b>" + formatCOP(Number(s.facturaActual.valor)) + "</b>\n\n" +
    "Deseas editar algun dato?\n\n" +
    "1 Editar Valor\n2 Editar NIT\n3 Editar Fecha\n4 Editar Concepto\n5 Siguiente"
  );
}

export async function procesarMensajeGastos(chatId: string, texto: string): Promise<boolean> {
  const s = await leerSesion(chatId);
  if (!s) return false;
  // Confirmacion rapida para pasos criticos
  if (texto === "2" && s.paso === "mas_facturas") {
    await enviarTelegram(chatId, "⏳ Generando reporte...");
  }

  if (s.paso === "ciudad") {
    s.ciudad = texto; s.paso = "motivo";
    await guardarSesion(chatId, s);
    await enviarTelegram(chatId, "Ciudad: <b>" + escHtml(texto) + "</b>\n\nEscribe el <b>motivo</b>:");
  } else if (s.paso === "motivo") {
    s.motivo = texto; s.paso = "fecha_inicio";
    await guardarSesion(chatId, s);
    await enviarTelegram(chatId, "Escribe la <b>fecha de inicio</b> (DD/MM/YYYY):");
  } else if (s.paso === "fecha_inicio") {
    s.fechaInicio = texto; s.paso = "fecha_fin";
    await guardarSesion(chatId, s);
    await enviarTelegram(chatId, "Escribe la <b>fecha fin</b> (DD/MM/YYYY):");
  } else if (s.paso === "fecha_fin") {
    s.fechaFin = texto; s.paso = "esperando_foto";
    await guardarSesion(chatId, s);
    await enviarTelegram(chatId, "Perfecto.\n\n📸 Sube la foto de la Factura #" + (s.facturas.length + 1) + ":");
  } else if (s.paso === "editar_datos") {
    if (texto === "1") { s.paso = "editar_valor"; await guardarSesion(chatId, s); await enviarTelegram(chatId, "Escribe el <b>nuevo valor</b> en COP:"); }
    else if (texto === "2") { s.paso = "editar_nit"; await guardarSesion(chatId, s); await enviarTelegram(chatId, "Escribe el <b>nuevo NIT</b>:"); }
    else if (texto === "3") { s.paso = "editar_fecha"; await guardarSesion(chatId, s); await enviarTelegram(chatId, "Escribe la <b>nueva fecha</b> (DD/MM/YYYY):"); }
    else if (texto === "4") { s.paso = "editar_concepto"; await guardarSesion(chatId, s); await enviarTelegram(chatId, "Escribe el <b>nuevo concepto</b>:"); }
    else if (texto === "5") { s.paso = "centro_costos"; await guardarSesion(chatId, s); await enviarTelegram(chatId, "Selecciona <b>Centro de Costos</b>:\n1 Ops-Activacion\n2 Ops-Retention"); }
  } else if (s.paso === "editar_valor") {
    s.facturaActual.valor = texto.replace(/[^0-9]/g, ""); s.paso = "editar_datos";
    await guardarSesion(chatId, s);
    await enviarTelegram(chatId, "Valor: <b>" + formatCOP(Number(s.facturaActual.valor)) + "</b>\n\n1 Editar Valor\n2 Editar NIT\n3 Editar Fecha\n4 Editar Concepto\n5 Siguiente");
  } else if (s.paso === "editar_nit") {
    s.facturaActual.nit = texto; s.paso = "editar_datos";
    await guardarSesion(chatId, s);
    await enviarTelegram(chatId, "NIT: <b>" + escHtml(texto) + "</b>\n\n1 Editar Valor\n2 Editar NIT\n3 Editar Fecha\n4 Editar Concepto\n5 Siguiente");
  } else if (s.paso === "editar_fecha") {
    s.facturaActual.fecha = texto; s.paso = "editar_datos";
    await guardarSesion(chatId, s);
    await enviarTelegram(chatId, "Fecha: <b>" + escHtml(texto) + "</b>\n\n1 Editar Valor\n2 Editar NIT\n3 Editar Fecha\n4 Editar Concepto\n5 Siguiente");
  } else if (s.paso === "editar_concepto") {
    s.facturaActual.concepto = texto; s.paso = "editar_datos";
    await guardarSesion(chatId, s);
    await enviarTelegram(chatId, "Concepto: <b>" + escHtml(texto) + "</b>\n\n1 Editar Valor\n2 Editar NIT\n3 Editar Fecha\n4 Editar Concepto\n5 Siguiente");
  } else if (s.paso === "centro_costos") {
    s.facturaActual.centroCostos = texto === "1" ? "Ops-Activacion" : "Ops-Retention";
    s.facturas.push({ ...s.facturaActual });
    s.facturaActual = undefined; s.paso = "mas_facturas";
    const total = s.facturas.reduce((acc: number, f: any) => acc + Number(String(f.valor).replace(/[^0-9]/g, "")), 0);
    await guardarSesion(chatId, s);
    await enviarTelegram(chatId, "Factura #" + s.facturas.length + " guardada. Total: <b>" + formatCOP(total) + "</b>\n\nAgregar otra?\n1 Si\n2 No, generar reporte");
  } else if (s.paso === "mas_facturas") {
    if (texto === "1") {
      s.paso = "esperando_foto"; await guardarSesion(chatId, s);
      await enviarTelegram(chatId, "📸 Sube la foto de la Factura #" + (s.facturas.length + 1) + ":");
    } else {
      await guardarGastosEnSheet(s); s.paso = "correo"; await guardarSesion(chatId, s);
      await enviarTelegram(chatId, "Gastos guardados en Sheet.\n\nEscribe el <b>correo</b> para el reporte:\n(o escribe omitir)");
    }
  } else if (s.paso === "correo") {
    if (texto.toLowerCase() !== "omitir" && texto.includes("@")) {
      await enviarReporteGastos(chatId, s, texto);
    } else {
      await enviarTelegram(chatId, "Reporte completado.");
    }
    await borrarSesion(chatId);
  }
  return true;
}


async function enviarReporteDirecto(chatId: string, s: any): Promise<void> {
  const base = process.env.NEXTAUTH_URL || "https://micaja3-one.vercel.app";
  const internalKey = process.env.INTERNAL_API_KEY || "";
  const total = s.facturas.reduce((acc: number, f: any) => acc + Number(String(f.valor).replace(/[^0-9]/g, "")), 0);
  
  let htmlContent = "";
  try {
    const res = await fetch(base + "/api/gastos-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-key": internalKey },
      body: JSON.stringify({ nombre: s.nombre, cargo: s.cargo, cc: s.cc, ciudad: s.ciudad, motivo: s.motivo, fechaInicio: s.fechaInicio, fechaFin: s.fechaFin, facturas: s.facturas })
    });
    if (res.ok) htmlContent = await res.text();
  } catch(e) { console.error("gastos-pdf:", e); }

  if (htmlContent) {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim() || "";
    const blob = new Blob([htmlContent], { type: "text/html" });
    const formTg = new FormData();
    formTg.append("chat_id", chatId);
    formTg.append("document", blob, "Legalizacion_Gastos_" + s.nombre.replace(/\s+/g,"_") + ".html");
    formTg.append("caption", "📋 Legalizacion de Gastos\n👤 " + s.nombre + "\n📅 " + (s.fechaInicio||"") + " al " + (s.fechaFin||"") + "\n💰 Total: " + formatCOP(total));
    await fetch("https://api.telegram.org/bot" + token + "/sendDocument", { method: "POST", body: formTg });
    await enviarTelegram(chatId, "✅ Reporte generado. Total: <b>" + formatCOP(total) + "</b>");
  } else {
    await enviarTelegram(chatId, "❌ No se pudo generar el reporte. Intenta de nuevo.");
  }
}

async function guardarGastosEnSheet(s: any): Promise<void> {
  // Guardar todas las facturas en paralelo para ser mas rapido
  await Promise.all(s.facturas.map((f: any) =>
    appendSheetRow("MICAJA", "Gastos_Generales", [
      new Date().toISOString(), s.nombre, s.cargo, s.cc,
      s.ciudad || "", s.motivo || "", s.fechaInicio || "", s.fechaFin || "",
      f.concepto, f.centroCostos, f.nit || "", f.fecha, f.valor, "Aprobada"
    ])
  ));
}

async function enviarReporteGastos(chatId: string, s: any, correo: string): Promise<void> {
  const total = s.facturas.reduce((acc: number, f: any) => acc + Number(String(f.valor).replace(/[^0-9]/g, "")), 0);
  
  // Generar HTML del reporte
  const base = process.env.NEXTAUTH_URL || "https://micaja3-one.vercel.app";
  const internalKey = process.env.INTERNAL_API_KEY || "";
  let htmlContent = "";
  try {
    const res = await fetch(base + "/api/gastos-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-key": internalKey },
      body: JSON.stringify({
        nombre: s.nombre, cargo: s.cargo, cc: s.cc,
        ciudad: s.ciudad, motivo: s.motivo,
        fechaInicio: s.fechaInicio, fechaFin: s.fechaFin,
        facturas: s.facturas
      })
    });
    if (res.ok) htmlContent = await res.text();
  } catch(e) { console.error("gastos-pdf:", e); }

  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: process.env.RESEND_FROM || "MiCaja BIA Energy <onboarding@resend.dev>",
    to: [correo],
    subject: "Legalizacion Gastos - " + s.nombre + " - " + (s.fechaInicio||"") + " al " + (s.fechaFin||""),
    html: htmlContent || "<p>Reporte de gastos adjunto.</p>",
    attachments: htmlContent ? [{
      filename: "Legalizacion_Gastos_" + s.nombre.replace(/\s+/g,"_") + ".html",
      content: Buffer.from(htmlContent).toString("base64"),
    }] : [],
  });

  // Enviar archivo por Telegram
  if (htmlContent) {
    try {
      const token = process.env.TELEGRAM_BOT_TOKEN?.trim() || "";
      const formTg = new FormData();
      const blob = new Blob([htmlContent], { type: "text/html" });
      formTg.append("chat_id", chatId);
      formTg.append("document", blob, "Legalizacion_Gastos_" + s.nombre.replace(/\s+/g, "_") + ".html");
      formTg.append("caption", "📋 Reporte de Gastos\n💰 Total: " + formatCOP(total));
      await fetch("https://api.telegram.org/bot" + token + "/sendDocument", {
        method: "POST",
        body: formTg,
      });
    } catch(e) { console.error("sendDocument:", e); }
  }

  await enviarTelegram(chatId,
    "📧 Reporte enviado a <b>" + escHtml(correo) + "</b>\n" +
    "💰 Total: <b>" + formatCOP(total) + "</b>\n\n" +
    "✅ Legalizacion completada. Datos en Sheet <b>Gastos_Generales</b>."
  );
}
