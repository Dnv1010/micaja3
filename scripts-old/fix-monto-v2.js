const fs = require("fs");
const f = "lib/factura-parser.ts";
let c = fs.readFileSync(f, "utf8");

// Reemplazar toda la funcion extractMonto
const oldFunc = c.indexOf("function extractMonto(text: string): number | null {");
const endFunc = c.indexOf("\n// ", oldFunc + 10);

const newFunc = `function extractMonto(text: string): number | null {
  const patterns = [
    /(?:TOTAL\\s*A\\s*PAGAR|GRAN\\s*TOTAL|VALOR\\s*TOTAL|TOTAL\\s*FACTURA|NETO\\s*A\\s*PAGAR|VALOR\\s*A\\s*PAGAR)\\s*[:\\s]*(?:COP|\\$)?\\s*\\$?\\s*([\\d.,]+)/i,
    /(?:TARIFA|TARIFA\\s*TOTAL)\\s*[:\\s]*(?:COP|\\$)?\\s*\\$?\\s*([\\d.,]+)/i,
    /(?:^|\\s)TOTAL\\s*[:\\s]*(?:COP|\\$)?\\s*([\\d.,]+)/im,
    /SUBTOTAL\\s*[:\\s]*(?:COP|\\$)?\\s*([\\d.,]+)/i,
    /COP\\s*\\$?\\s*([\\d.,]+)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const raw = m[1].trim();
      const num = parseCOPAmount(raw);
      if (!isNaN(num) && num > 0) return num;
    }
  }
  return null;
}

/** Parsea montos en formato colombiano: 20.000 = 20000, 20.000,00 = 20000, 1.148.08 = 1148 */
function parseCOPAmount(raw: string): number {
  // Si tiene coma como decimal: 20.000,50 -> 20000.50
  if (raw.includes(",")) {
    return parseFloat(raw.replace(/\\./g, "").replace(",", "."));
  }
  // Solo puntos: contar decimales despues del ultimo punto
  const parts = raw.split(".");
  if (parts.length === 1) return parseFloat(raw);
  const lastPart = parts[parts.length - 1];
  // Si ultimo segmento es de 1-2 digitos, es decimal (20.000.00 -> los 00 son centavos)
  if (lastPart.length <= 2) {
    // Quitar centavos y juntar miles
    const entero = parts.slice(0, -1).join("");
    return parseFloat(entero);
  }
  // Todos son separadores de miles: 20.000 -> 20000
  return parseFloat(parts.join(""));
}
`;

c = c.substring(0, oldFunc) + newFunc + c.substring(endFunc);

fs.writeFileSync(f, c, "utf8");
console.log("ok");
