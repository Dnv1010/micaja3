const fs = require("fs");
const f = "app/api/telegram/webhook/route.ts";
let c = fs.readFileSync(f, "utf8");

// Quitar el if de mas_facturas que no hace await
c = c.replace(
  /    if \(sesionActiva\.paso === "mas_facturas" && texto === "2"\) \{\n\s*responsePromise\.catch\(e => console\.error\("gastos bg:", e\)\);\n\s*\}\n/,
  ""
);

fs.writeFileSync(f, c, "utf8");
console.log("ok:", !c.includes("responsePromise.catch"));
