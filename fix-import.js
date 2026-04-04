const fs = require("fs");
const f = "app/api/telegram/webhook/route.ts";
let c = fs.readFileSync(f, "utf8");

// Verificar si el import existe
const tieneImport = c.includes("telegram-gastos");
console.log("Tiene import gastos:", tieneImport);

// Si no tiene el import, agregarlo
if (!tieneImport) {
  c = c.replace(
    'import {\n  handleComandoEquipo,\n  handleComandoSaldo,\n  handleComandoStartHelp,\n} from "@/lib/telegram-commands";',
    'import {\n  handleComandoEquipo,\n  handleComandoSaldo,\n  handleComandoStartHelp,\n} from "@/lib/telegram-commands";\nimport { iniciarFlujGastos, procesarMensajeGastos, getSesionGastos } from "@/lib/telegram-gastos";'
  );
  fs.writeFileSync(f, c, "utf8");
  console.log("✅ Import agregado");
} else {
  console.log("Import ya existe");
}
