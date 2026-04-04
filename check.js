const fs = require("fs");
const f = "app/api/telegram/webhook/route.ts";
const c = fs.readFileSync(f, "utf8");
const idx = c.indexOf("sesionGastos2");
console.log("Encontrado en posicion:", idx);
console.log("Contexto:", c.substring(idx - 10, idx + 300));
