const fs = require("fs");
const f = "lib/telegram-gastos.ts";
let c = fs.readFileSync(f, "utf8");
c = c.replace(
  '"Factura #" + s.facturas.length + " guardada. Total: <b>" + formatCOP(total) + "</b>\\n\\nAgregar otra?\\n1 Si\\n2 No, generar reporte"',
  '"Factura #" + s.facturas.length + " guardada. Total: <b>" + formatCOP(total) + "</b>\\n\\nAgregar otra?\\n1 Si\\n2 No, generar reporte con /reporte"'
);
fs.writeFileSync(f, c, "utf8");
console.log("ok");
