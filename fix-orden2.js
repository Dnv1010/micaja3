const fs = require("fs");
const f = "app/api/telegram/webhook/route.ts";
let c = fs.readFileSync(f, "utf8");

const inicioBloque = c.indexOf("      // Si hay sesion de gastos activa, usar procesarFotoGasto");
const finBloque = c.indexOf("      }", inicioBloque) + 7;
const bloqueGastos = c.substring(inicioBloque, finBloque);

c = c.substring(0, inicioBloque) + c.substring(finBloque);

const idxRecib = c.indexOf("await enviarTelegram(chatId, ");
const idxLineaAntes = c.lastIndexOf("\n", idxRecib);
c = c.substring(0, idxLineaAntes) + "\n      " + bloqueGastos + "\n" + c.substring(idxLineaAntes);

fs.writeFileSync(f, c, "utf8");

const c2 = fs.readFileSync(f, "utf8");
const a = c2.indexOf("sesionGastos2");
const b = c2.indexOf("Recib");
console.log("sesionGastos2:", a, "Recib:", b, "OK:", a < b);
