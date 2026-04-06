const fs = require('fs');
let c = fs.readFileSync('app/api/gastos/enviar-telegram/route.ts', 'utf8');
c = c.replace(
'  const blob = new Blob([pdfBuffer], { type: "application/pdf" });',
'  const blob = new Blob([new Uint8Array(pdfBuffer)], { type: "application/pdf" });'
);
fs.writeFileSync('app/api/gastos/enviar-telegram/route.ts', c, 'utf8');
console.log('OK');
