const fs = require("fs");
const f = "app/api/gastos-pdf/route.ts";
let c = fs.readFileSync(f, "utf8");

c = c.replace(
  'import { GastosPdf } from "@/components/pdf/gastos-pdf";',
  'import { GastosPdf, GastosDocument } from "@/components/pdf/gastos-pdf";'
);

c = c.replace(
  'React.createElement(GastosPdf, { nombre, cargo, cc, ciudad, motivo, fechaInicio, fechaFin, facturas })',
  'React.createElement(GastosDocument, { nombre, cargo, cc, ciudad, motivo, fechaInicio, fechaFin, facturas })'
);

fs.writeFileSync(f, c, "utf8");
console.log("ok");
