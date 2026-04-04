const fs = require("fs");
const f = "app/api/telegram/webhook/route.ts";
let c = fs.readFileSync(f, "utf8");
c = c.replace(
  "await procesarMensajeGastos(chatId, texto, u0);",
  "await procesarMensajeGastos(chatId, texto);"
);
fs.writeFileSync(f, c, "utf8");
console.log("✅ Listo");
