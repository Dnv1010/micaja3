const fs = require("fs");
const f = "lib/telegram-gastos.ts";
let c = fs.readFileSync(f, "utf8");

c = c.replace(
  `  } else if (s.paso === "correo") {
    await borrarSesion(chatId);
    if (texto.toLowerCase() !== "omitir" && texto.includes("@")) {
      await enviarTelegram(chatId, "⏳ Enviando reporte a " + texto + "...");
      await guardarGastosEnSheet(s);
      await enviarReporteGastos(chatId, s, texto);
    } else {
      await guardarGastosEnSheet(s);
      await enviarTelegram(chatId, "Reporte completado. Datos guardados en Sheet.");
    }
  }`,
  `  } else if (s.paso === "mas_facturas" && texto === "2") {
    await borrarSesion(chatId);
    await enviarTelegram(chatId, "⏳ Generando reporte...");
    await guardarGastosEnSheet(s);
    await enviarReporteDirecto(chatId, s);
  }`
);

// Agregar funcion enviarReporteDirecto
const nuevaFuncion = `
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
    formTg.append("document", blob, "Legalizacion_Gastos_" + s.nombre.replace(/\\s+/g,"_") + ".html");
    formTg.append("caption", "📋 Legalizacion de Gastos\\n👤 " + s.nombre + "\\n📅 " + (s.fechaInicio||"") + " al " + (s.fechaFin||"") + "\\n💰 Total: " + formatCOP(total));
    await fetch("https://api.telegram.org/bot" + token + "/sendDocument", { method: "POST", body: formTg });
    await enviarTelegram(chatId, "✅ Reporte generado. Total: <b>" + formatCOP(total) + "</b>");
  } else {
    await enviarTelegram(chatId, "❌ No se pudo generar el reporte. Intenta de nuevo.");
  }
}`;

const idx = c.indexOf("async function guardarGastosEnSheet");
c = c.substring(0, idx) + nuevaFuncion + "\n\n" + c.substring(idx);

fs.writeFileSync(f, c, "utf8");
console.log("ok");
