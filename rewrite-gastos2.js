const fs = require("fs");

const content = `/* eslint-disable @typescript-eslint/no-explicit-any */
import { enviarTelegram, escHtml } from "@/lib/notificaciones";
import { formatCOP } from "@/lib/format";
import { appendSheetRow } from "@/lib/sheets-helpers";
import { Resend } from "resend";

interface FacturaGasto {
  concepto: string;
  centroCostos: string;
  fecha: string;
  valor: string;
  nit: string;
  urlImagen?: string;
}

interface SesionGastos {
  paso: string;
  nombre: string;
  cargo: string;
  cc: string;
  ciudad?: string;
  motivo?: string;
  fechaInicio?: string;
  fechaFin?: string;
  facturas: FacturaGasto[];
  facturaActual?: any;
}

const sesiones = new Map<string, SesionGastos>();

export function getSesionGastos(chatId: string) { return sesiones.get(chatId); }
export function deleteSesionGastos(chatId: string) { sesiones.delete(chatId); }

export async function iniciarFlujGastos(chatId: string, usuario: any): Promise<void> {
  sesiones.set(chatId, {
    paso: "ciudad",
    nombre: usuario.responsable || "",
    cargo: usuario.cargo || "",
    cc: usuario.cedula || "",
    facturas: []
  });
  await enviarTelegram(chatId, "📋 <b>Legalizacion de Gastos Generales</b>\\n\\nEscribe la <b>ciudad</b> del gasto:");
}

export async function procesarFotoGasto(chatId: string, datosOCR: any, imagenUrl: string): Promise<void> {
  const s = sesiones.get(chatId);
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
  await enviarTelegram(chatId,
    "📄 <b>Datos extraidos:</b>\\n" +
    "Concepto: <b>" + escHtml(s.facturaActual.concepto || "No detectado") + "</b>\\n" +
    "NIT: <b>" + escHtml(s.facturaActual.nit || "No detectado") + "</b>\\n" +
    "Fecha: <b>" + escHtml(s.facturaActual.fecha) + "</b>\\n" +
    "Valor: <b>" + formatCOP(Number(s.facturaActual.valor)) + "</b>\\n\\n" +
    "¿Deseas editar algun dato?\\n\\n" +
    "1 Editar Valor\\n" +
    "2 Editar NIT\\n" +
    "3 Editar Fecha\\n" +
    "4 Editar Concepto\\n" +
    "5 Siguiente (continuar)"
  );
}

export async function procesarMensajeGastos(chatId: string, texto: string): Promise<boolean> {
  const s = sesiones.get(chatId);
  if (!s) return false;

  if (s.paso === "ciudad") {
    s.ciudad = texto; s.paso = "motivo";
    await enviarTelegram(chatId, "Ciudad: <b>" + escHtml(texto) + "</b>\\n\\nEscribe el <b>motivo</b>:");
  } else if (s.paso === "motivo") {
    s.motivo = texto; s.paso = "fecha_inicio";
    await enviarTelegram(chatId, "Escribe la <b>fecha de inicio</b> (DD/MM/YYYY):");
  } else if (s.paso === "fecha_inicio") {
    s.fechaInicio = texto; s.paso = "fecha_fin";
    await enviarTelegram(chatId, "Escribe la <b>fecha fin</b> (DD/MM/YYYY):");
  } else if (s.paso === "fecha_fin") {
    s.fechaFin = texto; s.paso = "esperando_foto";
    await enviarTelegram(chatId, "✅ Perfecto.\\n\\n📸 Ahora <b>sube la foto</b> de la Factura #" + (s.facturas.length + 1) + ":");
  } else if (s.paso === "editar_datos") {
    if (texto === "1") {
      s.paso = "editar_valor";
      await enviarTelegram(chatId, "Escribe el <b>nuevo valor</b> en COP:");
    } else if (texto === "2") {
      s.paso = "editar_nit";
      await enviarTelegram(chatId, "Escribe el <b>nuevo NIT</b>:");
    } else if (texto === "3") {
      s.paso = "editar_fecha";
      await enviarTelegram(chatId, "Escribe la <b>nueva fecha</b> (DD/MM/YYYY):");
    } else if (texto === "4") {
      s.paso = "editar_concepto";
      await enviarTelegram(chatId, "Escribe el <b>nuevo concepto</b>:");
    } else if (texto === "5") {
      s.paso = "centro_costos";
      await enviarTelegram(chatId, "Selecciona <b>Centro de Costos</b>:\\n\\n1 Ops-Activacion\\n2 Ops-Retention");
    }
  } else if (s.paso === "editar_valor") {
    s.facturaActual.valor = texto.replace(/[^0-9]/g, "");
    s.paso = "editar_datos";
    await enviarTelegram(chatId, "✅ Valor actualizado: <b>" + formatCOP(Number(s.facturaActual.valor)) + "</b>\\n\\n¿Algo mas?\\n1 Editar Valor\\n2 Editar NIT\\n3 Editar Fecha\\n4 Editar Concepto\\n5 Siguiente");
  } else if (s.paso === "editar_nit") {
    s.facturaActual.nit = texto;
    s.paso = "editar_datos";
    await enviarTelegram(chatId, "✅ NIT actualizado: <b>" + escHtml(texto) + "</b>\\n\\n¿Algo mas?\\n1 Editar Valor\\n2 Editar NIT\\n3 Editar Fecha\\n4 Editar Concepto\\n5 Siguiente");
  } else if (s.paso === "editar_fecha") {
    s.facturaActual.fecha = texto;
    s.paso = "editar_datos";
    await enviarTelegram(chatId, "✅ Fecha actualizada: <b>" + escHtml(texto) + "</b>\\n\\n¿Algo mas?\\n1 Editar Valor\\n2 Editar NIT\\n3 Editar Fecha\\n4 Editar Concepto\\n5 Siguiente");
  } else if (s.paso === "editar_concepto") {
    s.facturaActual.concepto = texto;
    s.paso = "editar_datos";
    await enviarTelegram(chatId, "✅ Concepto actualizado: <b>" + escHtml(texto) + "</b>\\n\\n¿Algo mas?\\n1 Editar Valor\\n2 Editar NIT\\n3 Editar Fecha\\n4 Editar Concepto\\n5 Siguiente");
  } else if (s.paso === "centro_costos") {
    s.facturaActual.centroCostos = texto === "1" ? "Ops-Activacion" : "Ops-Retention";
    s.facturas.push({ ...s.facturaActual } as FacturaGasto);
    s.facturaActual = undefined;
    const total = s.facturas.reduce((acc: number, f: FacturaGasto) => acc + Number(f.valor.replace(/[^0-9]/g, "")), 0);
    s.paso = "mas_facturas";
    await enviarTelegram(chatId, "✅ Factura #" + s.facturas.length + " guardada.\\nTotal acumulado: <b>" + formatCOP(total) + "</b>\\n\\n¿Agregar otra factura?\\n1 Si\\n2 No, generar reporte");
  } else if (s.paso === "mas_facturas") {
    if (texto === "1") {
      s.paso = "esperando_foto";
      await enviarTelegram(chatId, "📸 Sube la foto de la Factura #" + (s.facturas.length + 1) + ":");
    } else {
      await guardarGastosEnSheet(s);
      s.paso = "correo";
      await enviarTelegram(chatId, "✅ Gastos guardados.\\n\\nEscribe el <b>correo</b> al que enviar el reporte PDF:\\n(o escribe <code>omitir</code>)");
    }
  } else if (s.paso === "correo") {
    if (texto.toLowerCase() !== "omitir" && texto.includes("@")) {
      await enviarReporteGastos(chatId, s, texto);
    } else {
      await enviarTelegram(chatId, "✅ Reporte completado sin envio por correo.");
    }
    sesiones.delete(chatId);
  }
  return true;
}

async function guardarGastosEnSheet(s: SesionGastos): Promise<void> {
  for (const f of s.facturas) {
    await appendSheetRow("MICAJA", "Gastos_Generales", [
      new Date().toISOString(), s.nombre, s.cargo, s.cc,
      s.ciudad || "", s.motivo || "", s.fechaInicio || "", s.fechaFin || "",
      f.concepto, f.centroCostos, f.nit, f.fecha, f.valor, "Aprobada"
    ]);
  }
}

async function enviarReporteGastos(chatId: string, s: SesionGastos, correo: string): Promise<void> {
  const total = s.facturas.reduce((acc: number, f: FacturaGasto) => acc + Number(f.valor.replace(/[^0-9]/g, "")), 0);
  const filas = s.facturas.map((f: FacturaGasto, i: number) =>
    \`<tr style="background:\${i%2===0?'#f9f9f9':'white'}">
      <td style="padding:8px;border:1px solid #ddd">\${i+1}</td>
      <td style="padding:8px;border:1px solid #ddd">\${f.concepto}</td>
      <td style="padding:8px;border:1px solid #ddd">\${f.centroCostos}</td>
      <td style="padding:8px;border:1px solid #ddd">\${f.nit}</td>
      <td style="padding:8px;border:1px solid #ddd">\${f.fecha}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:right">\${formatCOP(Number(f.valor))}</td>
    </tr>\`
  ).join("");

  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: process.env.RESEND_FROM || "MiCaja BIA Energy <onboarding@resend.dev>",
    to: [correo],
    subject: "Legalizacion de Gastos - " + s.nombre + " - " + (s.fechaInicio||"") + " al " + (s.fechaFin||""),
    html: \`<div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto">
      <div style="background:#001035;padding:20px;border-radius:8px 8px 0 0">
        <h2 style="color:#08DDBC;margin:0">⚡ BIA Energy SAS ESP</h2>
        <p style="color:white;margin:4px 0 0">Legalizacion de Gastos</p>
      </div>
      <div style="background:#f8f9fa;padding:24px;border:1px solid #e0e0e0">
        <table style="width:100%;margin-bottom:16px">
          <tr><td><b>Nombre:</b></td><td>\${s.nombre}</td><td><b>Cargo:</b></td><td>\${s.cargo}</td></tr>
          <tr><td><b>CC:</b></td><td>\${s.cc}</td><td><b>Ciudad:</b></td><td>\${s.ciudad||""}</td></tr>
          <tr><td><b>Motivo:</b></td><td colspan="3">\${s.motivo||""}</td></tr>
          <tr><td><b>Periodo:</b></td><td colspan="3">\${s.fechaInicio||""} al \${s.fechaFin||""}</td></tr>
        </table>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="background:#001035;color:white">
            <th style="padding:8px;border:1px solid #ddd">No.</th>
            <th style="padding:8px;border:1px solid #ddd">Concepto</th>
            <th style="padding:8px;border:1px solid #ddd">Centro Costos</th>
            <th style="padding:8px;border:1px solid #ddd">NIT</th>
            <th style="padding:8px;border:1px solid #ddd">Fecha</th>
            <th style="padding:8px;border:1px solid #ddd">Valor</th>
          </tr></thead>
          <tbody>\${filas}</tbody>
          <tfoot><tr style="background:#001035;color:white">
            <td colspan="5" style="padding:8px;text-align:right"><b>TOTAL:</b></td>
            <td style="padding:8px;text-align:right"><b>\${formatCOP(total)}</b></td>
          </tr></tfoot>
        </table>
        <p style="font-size:11px;color:#666;margin-top:16px">(1) TODOS LOS GASTOS DEBEN ENCONTRARSE DEBIDAMENTE SOPORTADOS Y TODAS LAS FACTURAS DEBEN ESTAR A NOMBRE DE BIA ENERGY S.A.S. E.S.P</p>
      </div>
    </div>\`
  });
  await enviarTelegram(chatId, "📧 Reporte enviado a <b>" + escHtml(correo) + "</b>\\n💰 Total: <b>" + formatCOP(total) + "</b>");
}
`;

fs.writeFileSync("lib/telegram-gastos.ts", content, "utf8");
console.log("ok");
