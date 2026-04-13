const fs = require("fs");
const f = "app/api/telegram/webhook/route.ts";
let c = fs.readFileSync(f, "utf8");

// Agregar import después de telegram-commands
c = c.replace(
  '} from "@/lib/telegram-commands";',
  '} from "@/lib/telegram-commands";\nimport { iniciarFlujGastos, procesarMensajeGastos, getSesionGastos } from "@/lib/telegram-gastos";'
);

fs.writeFileSync(f, c, "utf8");

// Verificar
const c2 = fs.readFileSync(f, "utf8");
console.log("Tiene import:", c2.includes("telegram-gastos"));
