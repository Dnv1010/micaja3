const fs = require("fs");
const f = "lib/factura-parser.ts";
let c = fs.readFileSync(f, "utf8");

// === FIX 1: NIT - reescribir extractNitProveedor completa ===
const nitStart = c.indexOf("function extractNitProveedor(text: string): string | null {");
const nitEnd = c.indexOf("\n// ", nitStart + 10);

const newNit = `function extractNitProveedor(text: string): string | null {
  const found: string[] = [];

  // Patron 1: NIT explicito (NIT, Nit, NIT., NIT:, N.I.T)
  const p1 = /N\\.?\\s*I\\.?\\s*T\\.?\\s*[:\\-.]?\\s*([\\d][\\d.\\s]{4,18}[\\-]?\\d?)/gi;
  let m: RegExpExecArray | null;
  while ((m = p1.exec(text)) !== null) {
    const clean = m[1].replace(/[.\\-\\s]/g, "");
    if (clean.length < 6) continue;
    const isBia = BIA_NITS.some((b) => clean.startsWith(b.replace(/[.\\-]/g, "")));
    if (!isBia) found.push(m[1].trim());
  }
  if (found[0]) return found[0];

  // Patron 2: formato colombiano sin label NIT (XXX.XXX.XXX-X)
  const p2 = /\\b(\\d{3}\\.\\d{3}\\.\\d{3}[\\-]\\d{1})\\b/g;
  while ((m = p2.exec(text)) !== null) {
    const clean = m[1].replace(/[.\\-]/g, "");
    const isBia = BIA_NITS.some((b) => clean.startsWith(b.replace(/[.\\-]/g, "")));
    if (!isBia) found.push(m[1].trim());
  }
  if (found[0]) return found[0];

  // Patron 3: numero largo despues de razon social (6-10 digitos con guion)
  const p3 = /(?:S\\.?A\\.?S|LTDA|S\\.?A\\.).*?\\n.*?(\\d{6,10}[\\-]\\d{1})/gi;
  while ((m = p3.exec(text)) !== null) {
    const clean = m[1].replace(/[.\\-]/g, "");
    const isBia = BIA_NITS.some((b) => clean.startsWith(b.replace(/[.\\-]/g, "")));
    if (!isBia) found.push(m[1].trim());
  }

  return found[0] || null;
}
`;

c = c.substring(0, nitStart) + newNit + c.substring(nitEnd);

// === FIX 2: Numero de factura - reescribir extractNumFactura ===
const numStart = c.indexOf("function extractNumFactura(text: string): string | null {");
const numEnd = c.indexOf("\n// ", numStart + 10);

const newNum = `function extractNumFactura(text: string): string | null {
  const patterns = [
    // Factura electronica de venta
    /(?:FACTURA\\s*ELECTR[OÓ]NICA\\s*(?:DE\\s*)?VENTA)\\s*(?:No\\.?|N[°ÚU]MERO|#|:)?\\s*[:\\-]?\\s*([A-Z0-9][A-Z0-9\\-]{1,20})/i,
    // VENTA sola
    /\\bVENTA\\s*(?:No\\.?|N\\.?|#|:)?\\s*[:\\-]?\\s*([A-Z0-9][A-Z0-9\\-]{1,20})/i,
    // FEV, FES, FE, FV prefijos
    /\\b(FE[VS]?\\s*[\\-]?\\s*\\d{1,15})\\b/i,
    /\\b(FV\\s*[\\-]?\\s*\\d{1,15})\\b/i,
    /\\b(FE\\s*[\\-]?\\s*[A-Z0-9]{1,15})\\b/i,
    // Factura No, N., No., #
    /(?:FACTURA|FACT)\\s*(?:No\\.?|N\\.?|N[°ÚU]|#|:)?\\s*[:\\-]?\\s*([A-Z0-9][A-Z0-9\\-]{1,20})/i,
    // No. o N. seguido de numero
    /(?:No\\.?|N\\.)\\s*[:\\-]?\\s*([A-Z0-9][A-Z0-9\\-]{1,20})/i,
    // # seguido de alfanumerico
    /#\\s*([A-Z0-9][A-Z0-9\\-]{1,20})/i,
    // RECIBO o TICKET
    /RECIBO\\s*(?:No\\.?|#|:)?\\s*(\\d{1,15})/i,
    /TICKET\\s*(?:No\\.?|#|:)?\\s*(\\d{1,15})/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const val = m[1].trim();
      // Filtrar falsos positivos (nombres, palabras comunes)
      if (/^(DE|DEL|LA|EL|LOS|LAS|POR|CON|SIN|FERNANDEZ|GARCIA|LOPEZ|MARTINEZ|SANCHEZ|RODRIGUEZ)$/i.test(val)) continue;
      if (val.length < 2) continue;
      return val;
    }
  }
  return null;
}
`;

c = c.substring(0, numStart) + newNum + c.substring(numEnd);

fs.writeFileSync(f, c, "utf8");
console.log("ok");
