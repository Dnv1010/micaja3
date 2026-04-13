const fs = require("fs");
const f = "app/api/telegram/webhook/route.ts";
let c = fs.readFileSync(f, "utf8");

// Usar import estatico existente
c = c.replace(
  'const { deleteSesionGastos } = await import("@/lib/telegram-gastos");',
  '// sesion cancelada'
);

// Agregar deleteSesionGastos al import existente
c = c.replace(
  'import { iniciarFlujGastos, procesarMensajeGastos, getSesionGastos, procesarFotoGasto } from "@/lib/telegram-gastos";',
  'import { iniciarFlujGastos, procesarMensajeGastos, getSesionGastos, procesarFotoGasto, deleteSesionGastos } from "@/lib/telegram-gastos";'
);

// Usar la funcion importada
c = c.replace(
  '// sesion cancelada\n    await deleteSesionGastos(chatId);',
  'await deleteSesionGastos(chatId);'
);

fs.writeFileSync(f, c, "utf8");
console.log("ok");
