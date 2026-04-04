const fs = require("fs");
const f = "app/api/telegram/webhook/route.ts";
let c = fs.readFileSync(f, "utf8");
c = c.replace(
  'import { iniciarFlujGastos, procesarMensajeGastos, getSesionGastos } from "@/lib/telegram-gastos";',
  'import { iniciarFlujGastos, procesarMensajeGastos, getSesionGastos, procesarFotoGasto } from "@/lib/telegram-gastos";'
);
fs.writeFileSync(f, c, "utf8");
console.log("ok");
