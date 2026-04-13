const fs = require("fs");
const f = "lib/telegram-gastos.ts";
let c = fs.readFileSync(f, "utf8");

// Agregar mensaje de procesando al inicio de procesarMensajeGastos
c = c.replace(
  "export async function procesarMensajeGastos(chatId: string, texto: string): Promise<boolean> {\n  const s = await leerSesion(chatId);\n  if (!s) return false;",
  `export async function procesarMensajeGastos(chatId: string, texto: string): Promise<boolean> {
  const s = await leerSesion(chatId);
  if (!s) return false;
  // Confirmacion rapida para pasos criticos
  if (texto === "2" && s.paso === "mas_facturas") {
    await enviarTelegram(chatId, "⏳ Generando reporte...");
  }`
);

fs.writeFileSync(f, c, "utf8");
console.log("ok");
