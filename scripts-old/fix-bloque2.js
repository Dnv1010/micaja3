const fs = require("fs");
const f = "app/api/telegram/webhook/route.ts";
let c = fs.readFileSync(f, "utf8");

const inicio = c.indexOf('  if (texto === "2") {');
if (inicio >= 0) {
  let nivel = 0;
  let i = inicio;
  while (i < c.length) {
    if (c[i] === "{") nivel++;
    if (c[i] === "}") { nivel--; if (nivel === 0) { i++; break; } }
    i++;
  }
  c = c.substring(0, inicio) + c.substring(i);
  console.log("✅ Bloque eliminado");
} else {
  console.log("No encontrado");
}

fs.writeFileSync(f, c, "utf8");
