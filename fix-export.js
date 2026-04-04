const fs = require("fs");

// 1. Agregar export en telegram-gastos.ts
const f1 = "lib/telegram-gastos.ts";
let c1 = fs.readFileSync(f1, "utf8");
if (!c1.includes("export async function deleteSesionGastos")) {
  c1 = c1.replace(
    "export async function getSesionGastos(chatId: string)",
    "export async function deleteSesionGastos(chatId: string): Promise<void> { await borrarSesion(chatId); }\n\nexport async function getSesionGastos(chatId: string)"
  );
  fs.writeFileSync(f1, c1, "utf8");
  console.log("✅ export agregado en telegram-gastos");
}
