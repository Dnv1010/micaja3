const fs = require("fs");
const f = "lib/telegram-gastos.ts";
let c = fs.readFileSync(f, "utf8");
c = c.replace(
  "async function enviarReporteDirecto",
  "export async function enviarReporteDirecto"
);
fs.writeFileSync(f, c, "utf8");
console.log("ok");
