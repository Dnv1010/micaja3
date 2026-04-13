const fs = require("fs");
const f = "lib/factura-parser.ts";
let c = fs.readFileSync(f, "utf8");

// Fix: regex que capture NITs con puntos como 830.101.026-6
c = c.replace(
  'const pattern = /N\\.?I\\.?T\\.?\\s*[:\\-]?\\s*([\\d]{6,15}[\\-]?\\d?)/gi;',
  'const pattern = /N\\.?I\\.?T\\.?\\s*[:\\-]?\\s*([\\d][\\d.]{4,18}[\\-]?\\d?)/gi;'
);

fs.writeFileSync(f, c, "utf8");

// Verificar
const c2 = fs.readFileSync(f, "utf8");
console.log("Tiene nuevo regex:", c2.includes("[\\d.]{4,18}"));
