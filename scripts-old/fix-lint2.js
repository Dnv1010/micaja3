const fs = require("fs");

// Fix 1 - telegram-gastos.ts
let f1 = "lib/telegram-gastos.ts";
let c1 = fs.readFileSync(f1, "utf8");
c1 = c1.replace(
  "export async function procesarMensajeGastos(chatId, texto, _usuario) {",
  "export async function procesarMensajeGastos(chatId, texto) {"
);
fs.writeFileSync(f1, c1, "utf8");

// Fix 2 - reporte-coordinador-client.tsx
let f2 = "components/coordinador/reporte-coordinador-client.tsx";
let c2 = fs.readFileSync(f2, "utf8");
c2 = c2.replace(
  "}, [selectedRows.length, totalSeleccionado, limite]);",
  "// eslint-disable-next-line react-hooks/exhaustive-deps\n  }, [selectedRows.length, totalSeleccionado, limite]);"
);
fs.writeFileSync(f2, c2, "utf8");

console.log("✅ Listo");
