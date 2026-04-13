const fs = require("fs");
const f = "lib/telegram-gastos.ts";
let c = fs.readFileSync(f, "utf8");

c = c.replace(
  `  let htmlContent = "";
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
    formTg.append("document", blob, "Legalizacion_Gastos_" + s.nombre.replace(/\\s+/g,"_") + ".html");`,
  `  let pdfBuffer: ArrayBuffer | null = null;
  try {
    const res = await fetch(base + "/api/gastos-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-key": internalKey },
      body: JSON.stringify({ nombre: s.nombre, cargo: s.cargo, cc: s.cc, ciudad: s.ciudad, motivo: s.motivo, fechaInicio: s.fechaInicio, fechaFin: s.fechaFin, facturas: s.facturas })
    });
    if (res.ok) pdfBuffer = await res.arrayBuffer();
  } catch(e) { console.error("gastos-pdf:", e); }

  if (pdfBuffer) {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim() || "";
    const blob = new Blob([pdfBuffer], { type: "application/pdf" });
    const formTg = new FormData();
    formTg.append("chat_id", chatId);
    formTg.append("document", blob, "Legalizacion_Gastos_" + s.nombre.replace(/\\s+/g,"_") + ".pdf");`
);

fs.writeFileSync(f, c, "utf8");
console.log("ok");
