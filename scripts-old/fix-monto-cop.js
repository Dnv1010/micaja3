const fs = require("fs");
const f = "lib/factura-parser.ts";
let c = fs.readFileSync(f, "utf8");

// Fix 1: NIT regex (si no se aplico antes)
if (!c.includes("[\\d.]{4,18}")) {
  c = c.replace(
    "const pattern = /N\\.?I\\.?T\\.?\\s*[:\\-]?\\s*([\\d]{6,15}[\\-]?\\d?)/gi;",
    "const pattern = /N\\.?I\\.?T\\.?\\s*[:\\-]?\\s*([\\d][\\d.]{4,18}[\\-]?\\d?)/gi;"
  );
  console.log("NIT regex fixed");
}

// Fix 2: Monto regex - agregar COP y mas patrones
c = c.replace(
  `  const patterns = [
    /(?:TOTAL\\s*A\\s*PAGAR|GRAN\\s*TOTAL|VALOR\\s*TOTAL|TOTAL\\s*FACTURA|NETO\\s*A\\s*PAGAR|TOTAL\\s*COP|VALOR\\s*A\\s*PAGAR)\\s*[:\\$\\s]*\\$?\\s*([\\d.,]+)/i,
    /(?:^|\\s)TOTAL\\s*\\$?\\s*([\\d.,]+)/im,
    /SUBTOTAL\\s*[:\\$\\s]*\\$?\\s*([\\d.,]+)/i,
  ];`,
  `  const patterns = [
    /(?:TOTAL\\s*A\\s*PAGAR|GRAN\\s*TOTAL|VALOR\\s*TOTAL|TOTAL\\s*FACTURA|NETO\\s*A\\s*PAGAR|TOTAL\\s*COP|VALOR\\s*A\\s*PAGAR)\\s*[:\\s]*(?:COP|\\$)?\\s*\\$?\\s*([\\d.,]+)/i,
    /(?:^|\\s)TOTAL\\s*[:\\s]*(?:COP|\\$)?\\s*([\\d.,]+)/im,
    /SUBTOTAL\\s*[:\\s]*(?:COP|\\$)?\\s*([\\d.,]+)/i,
    /COP\\s*\\$?\\s*([\\d.,]+)/i,
  ];`
);

fs.writeFileSync(f, c, "utf8");
console.log("ok - monto patterns updated");
