const fs = require("fs");
const f = "lib/telegram-commands.ts";
let c = fs.readFileSync(f, "utf8");

c = c.replace(
  '"<code>/equipo</code> — Ver saldo de todos tus tÃ©cnicos (solo coordinadores)",',
  '"<code>/equipo</code> — Ver saldo de todos tus tecnicos (solo coordinadores)",\n      "<code>/gastos</code> — Legalizar Gastos Generales (coordinadores/admin)",\n      "<code>/menu</code> — Ver todos los comandos disponibles",'
);

fs.writeFileSync(f, c, "utf8");
console.log("✅ help actualizado");
