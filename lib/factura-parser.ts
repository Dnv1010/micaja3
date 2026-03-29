export interface FacturaData {
  num_factura: string | null;
  fecha_factura: string | null;
  monto_factura: number | null;
  nit_factura: string | null;
  razon_social: string | null;
  nombre_bia: boolean;
  ciudad: string | null;
  descripcion: string | null;
}

export function parseFacturaText(text: string): FacturaData {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const fullText = text.toUpperCase();

  return {
    num_factura: extractNumFactura(fullText),
    fecha_factura: extractFecha(fullText),
    monto_factura: extractMonto(fullText),
    nit_factura: extractNit(fullText),
    razon_social: extractRazonSocial(lines),
    nombre_bia: checkNombreBia(fullText),
    ciudad: extractCiudad(fullText),
    descripcion: extractDescripcion(lines),
  };
}

function extractNumFactura(text: string): string | null {
  const patterns = [
    /(?:FACTURA|FACT|FV|FE|No\.?\s*FACTURA|FACTURA\s*(?:ELECTR[OÓ]NICA)?\s*(?:DE\s*VENTA)?)\s*(?:No\.?|N[UÚ]MERO|#|:)?\s*[:\-]?\s*([A-Z]{0,5}\s*[\-]?\s*\d{1,15})/i,
    /(?:N[UÚ]MERO|No\.?|#)\s*(?:DE\s*)?(?:FACTURA|DOCUMENTO)\s*[:\-]?\s*([A-Z]{0,5}\s*[\-]?\s*\d{1,15})/i,
    /(?:RECIBO|CUENTA\s*DE\s*COBRO|DOCUMENTO)\s*(?:No\.?|#|:)\s*([A-Z]{0,5}\s*[\-]?\s*\d{1,15})/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].replace(/\s+/g, " ").trim();
  }
  return null;
}

function extractFecha(text: string): string | null {
  const patterns = [
    /(?:FECHA\s*(?:DE\s*)?(?:EMISI[OÓ]N|FACTURA|EXPEDICI[OÓ]N)?)\s*[:\-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
    /(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/,
    /(\d{1,2})\s*(?:DE\s*)?(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPT(?:IEMBRE)?|OCT(?:UBRE)?|NOV(?:IEMBRE)?|DIC(?:IEMBRE)?)\s*(?:DE\s*)?(\d{4})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      if (match[2] && /[A-Z]/i.test(match[2])) {
        const months: Record<string, string> = {
          ENERO: "01",
          FEBRERO: "02",
          MARZO: "03",
          ABRIL: "04",
          MAYO: "05",
          JUNIO: "06",
          JULIO: "07",
          AGOSTO: "08",
          SEPTIEMBRE: "09",
          SEPT: "09",
          OCTUBRE: "10",
          OCT: "10",
          NOVIEMBRE: "11",
          NOV: "11",
          DICIEMBRE: "12",
          DIC: "12",
        };
        const m = months[match[2].toUpperCase()] || "01";
        return `${match[3]}-${m}-${match[1].padStart(2, "0")}`;
      }
      const parts = match[1] ? match[1].split(/[\/-]/) : match[0].split(/[\/-]/);
      if (parts.length === 3) {
        const day = parts[0].padStart(2, "0");
        const month = parts[1].padStart(2, "0");
        const year = parts[2].length === 2 ? "20" + parts[2] : parts[2];
        return `${year}-${month}-${day}`;
      }
    }
  }
  return null;
}

function extractMonto(text: string): number | null {
  const patterns = [
    /(?:TOTAL\s*A\s*PAGAR|GRAN\s*TOTAL|VALOR\s*TOTAL|TOTAL\s*FACTURA|NETO\s*A\s*PAGAR|TOTAL\s*COP)\s*[:\$\s]*\$?\s*([\d.,]+)/i,
    /(?:TOTAL)\s*[:\$\s]*\$?\s*([\d.,]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const numStr = match[1].replace(/\./g, "").replace(/,/g, ".");
      const num = parseFloat(numStr);
      if (!Number.isNaN(num) && num > 0) return num;
    }
  }
  return null;
}

function extractNit(text: string): string | null {
  const pattern = /(?:NIT|N\.?I\.?T\.?)\s*[:\-]?\s*([\d.,]+[\-]?\d?)/gi;
  const matches: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const nit = match[1].replace(/\./g, "").replace(/,/g, "");
    if (!nit.startsWith("901588412")) {
      matches.push(nit);
    }
  }
  return matches[0] || null;
}

function extractRazonSocial(lines: string[]): string | null {
  for (const line of lines.slice(0, 8)) {
    const upper = line.toUpperCase();
    if (
      upper.includes("S.A.S") ||
      upper.includes("SAS") ||
      upper.includes("S.A.") ||
      upper.includes("LTDA") ||
      upper.includes("E.U.") ||
      upper.includes("& CIA")
    ) {
      return line.replace(/NIT[:\s]*[\d.\-]+/gi, "").trim();
    }
  }
  return null;
}

function checkNombreBia(text: string): boolean {
  return (
    text.includes("BIA ENERGY") ||
    text.includes("BIA ENERG") ||
    text.includes("901.588.412") ||
    text.includes("901588412")
  );
}

function extractCiudad(text: string): string | null {
  const ciudades = [
    "BOGOTA",
    "BOGOTÁ",
    "BARRANQUILLA",
    "CARTAGENA",
    "SANTA MARTA",
    "MEDELLIN",
    "MEDELLÍN",
    "CALI",
    "BUCARAMANGA",
    "VALLEDUPAR",
    "SINCELEJO",
    "MONTERÍA",
    "MONTERIA",
    "SOLEDAD",
    "MALAMBO",
  ];
  for (const ciudad of ciudades) {
    if (text.includes(ciudad)) {
      const c = ciudad.toLowerCase();
      return c.charAt(0).toUpperCase() + c.slice(1);
    }
  }
  return null;
}

function extractDescripcion(lines: string[]): string | null {
  const keywords = ["CONCEPTO", "DESCRIPCI", "SERVICIO", "DETALLE", "PRODUCTO"];
  for (let i = 0; i < lines.length; i++) {
    const upper = lines[i].toUpperCase();
    if (keywords.some((k) => upper.includes(k))) {
      if (lines[i + 1]) return lines[i + 1].trim();
      return lines[i].replace(/^.*?[:\-]\s*/, "").trim();
    }
  }
  return null;
}
