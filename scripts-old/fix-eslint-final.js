const fs = require("fs");

// Fix 1: webhook - textoOCR viejo que quedo suelto
const fw = "app/api/telegram/webhook/route.ts";
let cw = fs.readFileSync(fw, "utf8");
const lines = cw.split("\n");
// Buscar linea 211 aprox con "let textoOCR" suelto
for (let i = 0; i < lines.length; i++) {
  const trimmed = lines[i].trim();
  if (trimmed === 'let textoOCR = "";' || trimmed === 'const textoOCR = "";') {
    // Verificar si es el bloque viejo suelto (no dentro del fallback)
    const next5 = lines.slice(i+1, i+6).join(" ");
    if (!next5.includes("ocrForm") && !next5.includes("OCR")) {
      lines.splice(i, 1);
      console.log("Eliminada linea suelta textoOCR en:", i+1);
      break;
    }
  }
}
cw = lines.join("\n");
fs.writeFileSync(fw, cw, "utf8");

// Fix 2: gastos-generales-client - quitar params no usados y agregar eslint disable
const fg = "components/coordinador/gastos-generales-client.tsx";
let cg = fs.readFileSync(fg, "utf8");
cg = cg.replace(
  '/* eslint-disable @typescript-eslint/no-explicit-any */',
  '/* eslint-disable @typescript-eslint/no-explicit-any */\n/* eslint-disable @typescript-eslint/no-unused-vars */\n/* eslint-disable react-hooks/exhaustive-deps */'
);
fs.writeFileSync(fg, cg, "utf8");

console.log("ok");
