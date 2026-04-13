const fs = require("fs");

// Fix 1: NIT regex en parser
const fp = "lib/factura-parser.ts";
let cp = fs.readFileSync(fp, "utf8");
cp = cp.replace(
  "const pattern = /N\\.?I\\.?T\\.?\\s*[:\\-]?\\s*([\\d]{6,15}[\\-]?\\d?)/gi;",
  "const pattern = /N\\.?I\\.?T\\.?\\s*[:\\-]?\\s*([\\d][\\d.]{4,18}[\\-]?\\d?)/gi;"
);
fs.writeFileSync(fp, cp, "utf8");
console.log("parser NIT fix:", cp.includes("[\\d.]{4,18}"));

// Fix 2: webhook - si no hay NIT proveedor, no marcar aNombreBia
const fw = "app/api/telegram/webhook/route.ts";
let cw = fs.readFileSync(fw, "utf8");
cw = cw.replace(
  "aNombreBia: datos.nombre_bia,",
  "aNombreBia: datos.nombre_bia && !!datos.nit_factura,"
);
fs.writeFileSync(fw, cw, "utf8");
console.log("webhook fix:", cw.includes("&& !!datos.nit_factura"));
