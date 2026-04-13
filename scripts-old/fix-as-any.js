const fs = require("fs");
const f = "app/api/gastos-pdf/route.ts";
let c = fs.readFileSync(f, "utf8");
c = c.replace(
  "const pdfBuffer = await renderToBuffer(\n    React.createElement(GastosDocument, { nombre, cargo, cc, ciudad, motivo, fechaInicio, fechaFin, facturas })\n  );",
  "// eslint-disable-next-line @typescript-eslint/no-explicit-any\n  const pdfBuffer = await renderToBuffer(React.createElement(GastosDocument, { nombre, cargo, cc, ciudad, motivo, fechaInicio, fechaFin, facturas }) as any);"
);
fs.writeFileSync(f, c, "utf8");
console.log("ok");
