const fs = require("fs");
const f = "lib/factura-parser.ts";
let c = fs.readFileSync(f, "utf8");

// Reemplazar parseCOPAmount completo
c = c.replace(
  /\/\*\* Parsea montos en formato colombiano.*?^}/ms,
  `/** Parsea montos colombianos: puntos y comas son miles, centavos se ignoran */
function parseCOPAmount(raw: string): number {
  // Quitar espacios
  let s = raw.trim();
  // Si termina en ,XX o .XX (1-2 digitos) -> son centavos, quitar
  s = s.replace(/[.,]\\d{1,2}$/, "");
  // Quitar todos los puntos y comas restantes (son miles)
  s = s.replace(/[.,]/g, "");
  const n = parseInt(s, 10);
  return isNaN(n) ? 0 : n;
}`
);

fs.writeFileSync(f, c, "utf8");
console.log("ok");

// Verificar
const c2 = fs.readFileSync(f, "utf8");
console.log("tiene parseCOPAmount:", c2.includes("parseCOPAmount"));
console.log("tiene centavos:", c2.includes("centavos"));
