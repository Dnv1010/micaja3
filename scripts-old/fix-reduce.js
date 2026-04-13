const fs = require("fs");
const f = "lib/telegram-gastos.ts";
let c = fs.readFileSync(f, "utf8");
c = c.replace(
  "s.facturas.reduce((acc, f) =>",
  "s.facturas.reduce((acc: number, f: any) =>"
);
fs.writeFileSync(f, c, "utf8");
console.log("ok");
