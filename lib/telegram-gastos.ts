import { enviarTelegram, escHtml } from "@/lib/notificaciones";
import { formatCOP } from "@/lib/format";
import { appendSheetRow } from "@/lib/sheets-helpers";

const sesiones = new Map();

export function getSesionGastos(chatId) { return sesiones.get(chatId); }
export function setSesionGastos(chatId, data) { sesiones.set(chatId, data); }
export function deleteSesionGastos(chatId) { sesiones.delete(chatId); }

export async function iniciarFlujGastos(chatId, usuario) {
  sesiones.set(chatId, {
    paso: "ciudad",
    nombre: usuario.responsable,
    cargo: usuario.cargo || "",
    cc: usuario.cedula || "",
    facturas: []
  });
  await enviarTelegram(chatId, "📋 <b>Legalización de Gastos Generales</b>\n\nEscribe la <b>ciudad</b> del gasto:");
}

export async function procesarMensajeGastos(chatId, texto, _usuario) {
  const s = sesiones.get(chatId);
  if (!s) return false;

  if (s.paso === "ciudad") {
    s.ciudad = texto;
    s.paso = "motivo";
    await enviarTelegram(chatId, "✅ Ciudad: " + escHtml(texto) + "\n\nEscribe el <b>motivo</b> del gasto:");
  } else if (s.paso === "motivo") {
    s.motivo = texto;
    s.paso = "fecha_inicio";
    await enviarTelegram(chatId, "✅ Motivo guardado.\n\nEscribe la <b>fecha de inicio</b> (DD/MM/YYYY):");
  } else if (s.paso === "fecha_inicio") {
    s.fechaInicio = texto;
    s.paso = "fecha_fin";
    await enviarTelegram(chatId, "✅ Fecha inicio: " + escHtml(texto) + "\n\nEscribe la <b>fecha fin</b> (DD/MM/YYYY):");
  } else if (s.paso === "fecha_fin") {
    s.fechaFin = texto;
    s.paso = "factura_concepto";
    await enviarTelegram(chatId, "✅ Perfecto.\n\n<b>Factura #" + (s.facturas.length + 1) + "</b>\nEscribe el <b>concepto</b>:");
  } else if (s.paso === "factura_concepto") {
    s.facturaActual = { concepto: texto };
    s.paso = "factura_centro";
    await enviarTelegram(chatId, "Selecciona el <b>Centro de Costos</b>:\n\n1️⃣ Ops-Activacion\n2️⃣ Ops-Retention\n\nEscribe 1 o 2:");
  } else if (s.paso === "factura_centro") {
    s.facturaActual.centroCostos = texto === "1" ? "Ops-Activacion" : "Ops-Retention";
    s.paso = "factura_valor";
    await enviarTelegram(chatId, "Centro: <b>" + s.facturaActual.centroCostos + "</b>\n\nEscribe el <b>valor</b> en COP (solo números):");
  } else if (s.paso === "factura_valor") {
    s.facturaActual.valor = texto;
    s.facturaActual.fecha = new Date().toLocaleDateString("es-CO");
    s.facturas.push({ ...s.facturaActual });
    s.facturaActual = null;
    s.paso = "mas_facturas";
    const total = s.facturas.reduce((acc, f) => acc + Number(f.valor.replace(/[^0-9]/g, "")), 0);
    await enviarTelegram(chatId, "✅ Factura guardada. Total acumulado: <b>" + formatCOP(total) + "</b>\n\n¿Agregar otra factura?\n\n1️⃣ Sí\n2️⃣ No, generar reporte");
  } else if (s.paso === "mas_facturas") {
    if (texto === "1") {
      s.paso = "factura_concepto";
      await enviarTelegram(chatId, "<b>Factura #" + (s.facturas.length + 1) + "</b>\nEscribe el <b>concepto</b>:");
    } else {
      // Guardar en Sheets y pedir correo
      await guardarGastosEnSheet(s);
      s.paso = "correo";
      await enviarTelegram(chatId, "✅ Gastos guardados.\n\nEscribe el <b>correo</b> al que enviar el reporte (o escribe <code>omitir</code>):");
    }
  } else if (s.paso === "correo") {
    if (texto.toLowerCase() !== "omitir" && texto.includes("@")) {
      await enviarReporteGastos(chatId, s, texto);
    } else {
      await enviarTelegram(chatId, "✅ Reporte completado sin envío por correo.");
    }
    sesiones.delete(chatId);
  }
  return true;
}

async function guardarGastosEnSheet(s) {
  for (const f of s.facturas) {
    await appendSheetRow("MICAJA", "Gastos_Generales", [
      new Date().toISOString(),
      s.nombre,
      s.cargo,
      s.cc,
      s.ciudad,
      s.motivo,
      s.fechaInicio,
      s.fechaFin,
      f.concepto,
      f.centroCostos,
      f.fecha,
      f.valor,
      "Aprobada"
    ]);
  }
}

async function enviarReporteGastos(chatId, s, correo) {
  const total = s.facturas.reduce((acc, f) => acc + Number(f.valor.replace(/[^0-9]/g, "")), 0);
  const resumen = s.facturas.map((f, i) =>
    (i+1) + ". " + f.concepto + " - " + f.centroCostos + " - " + f.fecha + " - " + formatCOP(Number(f.valor.replace(/[^0-9]/g, "")))
  ).join("\n");

  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: process.env.RESEND_FROM || "MiCaja BIA Energy <onboarding@resend.dev>",
    to: [correo],
    subject: "Legalizacion de Gastos - " + s.nombre + " - " + s.fechaInicio + " al " + s.fechaFin,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px">
      <h2 style="color:#001035">BIA Energy SAS ESP - Legalizacion de Gastos</h2>
      <p><b>Nombre:</b> ${s.nombre}</p>
      <p><b>Cargo:</b> ${s.cargo}</p>
      <p><b>CC:</b> ${s.cc}</p>
      <p><b>Ciudad:</b> ${s.ciudad}</p>
      <p><b>Motivo:</b> ${s.motivo}</p>
      <p><b>Periodo:</b> ${s.fechaInicio} al ${s.fechaFin}</p>
      <hr/>
      <pre>${resumen}</pre>
      <hr/>
      <p><b>TOTAL: ${formatCOP(total)}</b></p>
    </div>`
  });

  await enviarTelegram(chatId, "📧 Reporte enviado a <b>" + escHtml(correo) + "</b>\n\n💰 Total: <b>" + formatCOP(total) + "</b>");
}
