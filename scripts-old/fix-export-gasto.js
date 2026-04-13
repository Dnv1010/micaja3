const fs = require("fs");
const f = "lib/telegram-gastos.ts";
let c = fs.readFileSync(f, "utf8");
c = c.replace(
  "async function guardarGastosEnSheet(s: any)",
  "export async function guardarGastosEnSheetPublic(s: any): Promise<void> { return guardarGastosEnSheet(s); }\n\nasync function guardarGastosEnSheet(s: any)"
);
// Cambiar paso listo a que guarde en sesion
c = c.replace(
  `      s.paso = "listo"; await guardarSesion(chatId, s);
      await enviarTelegram(chatId, "✅ Facturas registradas.\\n\\nEscribe <code>/reporte</code> para generar y recibir el PDF aqui.");`,
  `      s.paso = "listo"; await guardarSesion(chatId, s);
      await enviarTelegram(chatId, "✅ Facturas listas.\\n\\nEscribe <code>/reporte</code> para generar el PDF.");`
);
fs.writeFileSync(f, c, "utf8");
console.log("ok");
