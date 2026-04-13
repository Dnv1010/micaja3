const fs = require("fs");
const f = "lib/telegram-gastos.ts";
let c = fs.readFileSync(f, "utf8");

// Reemplazar la funcion enviarReporteGastos completa
const viejaFuncion = c.substring(c.indexOf("async function enviarReporteGastos"));
const nuevaFuncion = `async function enviarReporteGastos(chatId: string, s: any, correo: string): Promise<void> {
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
      filename: "Legalizacion_Gastos_" + s.nombre.replace(/\\s+/g,"_") + ".html",
      content: Buffer.from(htmlContent).toString("base64"),
    }] : [],
  });

  await enviarTelegram(chatId,
    "📧 Reporte enviado a <b>" + escHtml(correo) + "</b>\\n" +
    "💰 Total: <b>" + formatCOP(total) + "</b>\\n\\n" +
    "✅ Legalizacion completada. Datos en Sheet <b>Gastos_Generales</b>."
  );
}`;

const idx = c.indexOf("async function enviarReporteGastos");
c = c.substring(0, idx) + nuevaFuncion + "\n";
fs.writeFileSync(f, c, "utf8");
console.log("ok");
