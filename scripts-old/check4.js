const fs = require("fs");
const f = "lib/telegram-gastos.ts";
let c = fs.readFileSync(f, "utf8");

// Buscar el texto exacto del paso mas_facturas
const idx = c.indexOf('s.paso = "mas_facturas"');
console.log("mas_facturas en posicion:", idx);
console.log("Contexto:", c.substring(idx - 20, idx + 200));
