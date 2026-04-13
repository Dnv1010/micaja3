const fs = require("fs");

const content = `/* eslint-disable @typescript-eslint/no-explicit-any */
import { enviarTelegram, escHtml } from "@/lib/notificaciones";
import { formatCOP } from "@/lib/format";
import { appendSheetRow } from "@/lib/sheets-helpers";
import { Resend } from "resend";

interface FacturaGasto { concepto: string; centroCostos: string; fecha: string; valor: string; }
interface SesionGastos { paso: string; nombre: string; cargo: string; cc: string; ciudad?: string; motivo?: string; fechaInicio?: string; fechaFin?: string; facturas: FacturaGasto[]; facturaActual?: any; }

const sesiones = new Map<string, SesionGastos>();

export function getSesionGastos(chatId: string) { return sesiones.get(chatId); }
export function deleteSesionGastos(chatId: string) { sesiones.delete(chatId); }

export async function iniciarFlujGastos(chatId: string, usuario: any): Promise<void> {
  sesiones.set(chatId, { paso: "ciudad", nombre: usuario.responsable || "", cargo: usuario.cargo || "", cc: usuario.cedula || "", facturas: [] });
  await enviarTelegram(chatId, "📋 <b>Legalizacion de Gastos Generales</b>\\n\\nEscribe la <b>ciudad</b> del gasto:");
}

export async function procesarMensajeGastos(chatId: string, texto: string): Promise<boolean> {
  const s = sesiones.get(chatId);
  if (!s) return false;
  if (s.paso === "ciudad") {
    s.ciudad = texto; s.paso = "motivo";
    await enviarTelegram(chatId, "Ciudad: " + escHtml(texto) + "\\n\\nEscribe el <b>motivo</b>:");
  } else if (s.paso === "motivo") {
    s.motivo = texto; s.paso = "fecha_inicio";
    await enviarTelegram(chatId, "Escribe la <b>fecha de inicio</b> (DD/MM/YYYY):");
  } else if (s.paso === "fecha_inicio") {
    s.fechaInicio = texto; s.paso = "fecha_fin";
    await enviarTelegram(chatId, "Escribe la <b>fecha fin</b> (DD/MM/YYYY):");
  } else if (s.paso === "fecha_fin") {
    s.fechaFin = texto; s.paso = "factura_concepto";
    await enviarTelegram(chatId, "<b>Factura #" + (s.facturas.length + 1) + "</b>\\nEscribe el <b>concepto</b>:");
  } else if (s.paso === "factura_concepto") {
    s.facturaActual = { concepto: texto }; s.paso = "factura_centro";
    await enviarTelegram(chatId, "Selecciona <b>Centro de Costos</b>:\\n\\n1 Ops-Activacion\\n2 Ops-Retention\\n\\nEscribe 1 o 2:");
  } else if (s.paso === "factura_centro") {
    s.facturaActual.centroCostos = texto === "1" ? "Ops-Activacion" : "Ops-Retention"; s.paso = "factura_valor";
    await enviarTelegram(chatId, "Centro: <b>" + s.facturaActual.centroCostos + "</b>\\n\\nEscribe el <b>valor</b> en COP:");
  } else if (s.paso === "factura_valor") {
    s.facturaActual.valor = texto;
    s.facturaActual.fecha = new Date().toLocaleDateString("es-CO");
    s.facturas.push({ ...s.facturaActual } as FacturaGasto);
    s.facturaActual = undefined; s.paso = "mas_facturas";
    const total = s.facturas.reduce((acc: number, f: FacturaGasto) => acc + Number(f.valor.replace(/[^0-9]/g, "")), 0);
    await enviarTelegram(chatId, "Factura guardada. Total: <b>" + formatCOP(total) + "</b>\\n\\nAgregar otra?\\n1 Si\\n2 No, generar reporte");
  } else if (s.paso === "mas_facturas") {
    if (texto === "1") {
      s.paso = "factura_concepto";
      await enviarTelegram(chatId, "<b>Factura #" + (s.facturas.length + 1) + "</b>\\nEscribe el <b>concepto</b>:");
    } else {
      await guardarGastosEnSheet(s); s.paso = "correo";
      await enviarTelegram(chatId, "Gastos guardados.\\n\\nEscribe el <b>correo</b> para enviar el reporte (o escribe omitir):");
    }
  } else if (s.paso === "correo") {
    if (texto.toLowerCase() !== "omitir" && texto.includes("@")) {
      await enviarReporteGastos(chatId, s, texto);
    } else {
      await enviarTelegram(chatId, "Reporte completado sin envio por correo.");
    }
    sesiones.delete(chatId);
  }
  return true;
}

async function guardarGastosEnSheet(s: SesionGastos): Promise<void> {
  for (const f of s.facturas) {
    await appendSheetRow("MICAJA", "Gastos_Generales", [
      new Date().toISOString(), s.nombre, s.cargo, s.cc, s.ciudad || "", s.motivo || "",
      s.fechaInicio || "", s.fechaFin || "", f.concepto, f.centroCostos, f.fecha, f.valor, "Aprobada"
    ]);
  }
}

async function enviarReporteGastos(chatId: string, s: SesionGastos, correo: string): Promise<void> {
  const total = s.facturas.reduce((acc: number, f: FacturaGasto) => acc + Number(f.valor.replace(/[^0-9]/g, "")), 0);
  const resumen = s.facturas.map((f: FacturaGasto, i: number) =>
    (i+1) + ". " + f.concepto + " - " + f.centroCostos + " - " + f.fecha + " - " + formatCOP(Number(f.valor.replace(/[^0-9]/g, "")))
  ).join("<br/>");
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: process.env.RESEND_FROM || "MiCaja BIA Energy <onboarding@resend.dev>",
    to: [correo],
    subject: "Legalizacion de Gastos - " + s.nombre + " - " + s.fechaInicio + " al " + s.fechaFin,
    html: "<div style='font-family:Arial'><h2>BIA Energy - Legalizacion de Gastos</h2><p><b>Nombre:</b> " + s.nombre + "</p><p><b>Cargo:</b> " + s.cargo + "</p><p><b>CC:</b> " + s.cc + "</p><p><b>Ciudad:</b> " + (s.ciudad||"") + "</p><p><b>Motivo:</b> " + (s.motivo||"") + "</p><p><b>Periodo:</b> " + (s.fechaInicio||"") + " al " + (s.fechaFin||"") + "</p><hr/><p>" + resumen + "</p><hr/><p><b>TOTAL: " + formatCOP(total) + "</b></p></div>"
  });
  await enviarTelegram(chatId, "Reporte enviado a <b>" + escHtml(correo) + "</b>\\n\\nTotal: <b>" + formatCOP(total) + "</b>");
}
`;

fs.writeFileSync("lib/telegram-gastos.ts", content, "utf8");
console.log("ok");
