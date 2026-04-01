export interface FacturaData {
  num_factura: string | null;
  fecha_factura: string | null; // DD/MM/YYYY
  monto_factura: number | null;
  nit_factura: string | null; // NIT del PROVEEDOR (no de BIA)
  razon_social: string | null; // Nombre del proveedor
  nombre_bia: boolean; // true si la factura está a nombre de BIA
  ciudad: string | null;
  descripcion: string | null; // Concepto detallado
  tipo_factura: string | null; // POS / Electrónica / A Mano / Equivalente / etc
  servicio_declarado: string | null; // Parqueadero / Peaje / Alimentación / etc
}

// NIT de BIA Energy SAS ESP — si aparece en la factura, está a nombre de BIA
const BIA_NITS = [
  "901588413",
  "901.588.413",
  "901588412",
  "901.588.412", // variante antigua
];

export function parseFacturaText(rawText: string): FacturaData {
  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const text = rawText.toUpperCase();

  return {
    num_factura: extractNumFactura(text),
    fecha_factura: extractFecha(text),
    monto_factura: extractMonto(text),
    nit_factura: extractNitProveedor(text),
    razon_social: extractRazonSocial(lines),
    nombre_bia: checkNombreBia(text),
    ciudad: extractCiudad(text),
    descripcion: extractDescripcion(lines, text),
    tipo_factura: detectTipoFactura(text, lines),
    servicio_declarado: detectServicio(text),
  };
}

// ─── NIT del PROVEEDOR ────────────────────────────────────────────────────────
// Extrae TODOS los NITs de la factura y descarta los de BIA → el que queda es del proveedor
function extractNitProveedor(text: string): string | null {
  const pattern = /N\.?I\.?T\.?\s*[:\-]?\s*([\d]{6,15}[\-]?\d?)/gi;
  const found: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    const clean = m[1].replace(/[.\-]/g, "");
    const isBia = BIA_NITS.some((b) => clean.startsWith(b.replace(/[.\-]/g, "")));
    if (!isBia) found.push(m[1].trim());
  }
  return found[0] || null;
}

// ─── A NOMBRE DE BIA ─────────────────────────────────────────────────────────
function checkNombreBia(text: string): boolean {
  return (
    BIA_NITS.some((nit) => text.includes(nit.toUpperCase())) ||
    text.includes("BIA ENERGY") ||
    text.includes("BIA ENERG")
  );
}

// ─── FECHA → DD/MM/YYYY ──────────────────────────────────────────────────────
function extractFecha(text: string): string | null {
  const monthMap: Record<string, string> = {
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

  // DD de MMMM de YYYY
  const m1 = text.match(
    /(\d{1,2})\s+DE\s+(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|SEPT|OCTUBRE|OCT|NOVIEMBRE|NOV|DICIEMBRE|DIC)\s+DE\s+(\d{4})/i
  );
  if (m1) return `${m1[1].padStart(2, "0")}/${monthMap[m1[2].toUpperCase()]}/${m1[3]}`;

  // DD/MM/YYYY o DD-MM-YYYY
  const m2 = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m2) return `${m2[1].padStart(2, "0")}/${m2[2].padStart(2, "0")}/${m2[3]}`;

  // YYYY-MM-DD (formato ISO)
  const m3 = text.match(/(\d{4})[\/\-](\d{2})[\/\-](\d{2})/);
  if (m3) return `${m3[3]}/${m3[2]}/${m3[1]}`;

  return null;
}

// ─── MONTO ────────────────────────────────────────────────────────────────────
function extractMonto(text: string): number | null {
  const patterns = [
    /(?:TOTAL\s*A\s*PAGAR|GRAN\s*TOTAL|VALOR\s*TOTAL|TOTAL\s*FACTURA|NETO\s*A\s*PAGAR|TOTAL\s*COP|VALOR\s*A\s*PAGAR)\s*[:\$\s]*\$?\s*([\d.,]+)/i,
    /(?:^|\s)TOTAL\s*\$?\s*([\d.,]+)/im,
    /SUBTOTAL\s*[:\$\s]*\$?\s*([\d.,]+)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      // Formato colombiano: puntos como miles, coma como decimal
      const raw = m[1].trim();
      const num = raw.includes(",")
        ? parseFloat(raw.replace(/\./g, "").replace(",", "."))
        : parseFloat(raw.replace(/\./g, ""));
      if (!isNaN(num) && num > 0) return num;
    }
  }
  return null;
}

// ─── RAZÓN SOCIAL ─────────────────────────────────────────────────────────────
function extractRazonSocial(lines: string[]): string | null {
  const indicators = ["S.A.S", "SAS", "S.A.", "LTDA", "E.U.", "& CIA", "S.A.S.", "INC.", "CORP"];
  // Buscar en primeras 10 líneas
  for (const line of lines.slice(0, 10)) {
    const upper = line.toUpperCase();
    if (indicators.some((i) => upper.includes(i))) {
      // Limpiar NIT de la misma línea si viene junto
      return line.replace(/NIT[:\s]*[\d.\-]+/gi, "").trim();
    }
  }
  // Si no hay forma jurídica, tomar la primera línea no vacía y no numérica
  for (const line of lines.slice(0, 5)) {
    if (!/^\d/.test(line) && line.length > 4) return line.trim();
  }
  return null;
}

// ─── NÚMERO DE FACTURA ────────────────────────────────────────────────────────
function extractNumFactura(text: string): string | null {
  const patterns = [
    /\b(FE[VS]?\s*[\-]?\s*\d{1,15})\b/i, // FEV3418, FES123, FE-001
    /\b(FV\s*[\-]?\s*\d{1,15})\b/i, // FV001, FV-3418
    /\b(FE\s*[\-]?\s*[A-Z0-9]{1,15})\b/i, // FE + alfanumérico
    /(?:FACTURA|FACT)\s*(?:No\.?|N°|#|:)?\s*([A-Z]{1,4}[\-]?\d{1,15})/i,
    /(?:FACTURA|FACT|FV|FE)\s*(?:ELECTR[OÓ]NICA\s*)?(?:DE\s*VENTA\s*)?(?:No\.?|N[ÚU]MERO|#|:)?\s*[:\-]?\s*([A-Z]{0,5}[\-]?\d{1,15})/i,
    /(?:N[ÚU]MERO|No\.?|#)\s*(?:DE\s*)?FACTURA\s*[:\-]?\s*([A-Z]{0,5}[\-]?\d{1,15})/i,
    /RECIBO\s*(?:No\.?|#|:)\s*(\d{1,15})/i,
    /TICKET\s*(?:No\.?|#|:)?\s*(\d{1,15})/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim();
  }
  return null;
}

// ─── DESCRIPCIÓN / CONCEPTO ───────────────────────────────────────────────────
function extractDescripcion(lines: string[], text: string): string | null {
  void text;

  const isCufe = (line: string) =>
    /^[a-f0-9]{20,}$/i.test(line.replace(/\s/g, "")) ||
    line.toLowerCase().startsWith("cufe") ||
    line.toLowerCase().startsWith("cude");

  const keywords = ["CONCEPTO", "DESCRIPCI", "SERVICIO", "DETALLE", "PRODUCTO"];
  for (let i = 0; i < lines.length; i++) {
    const upper = lines[i].toUpperCase();
    if (keywords.some((k) => upper.includes(k))) {
      const next = lines[i + 1];
      if (next && next.length > 2 && !isCufe(next)) return next.trim();
      const current = lines[i].replace(/^.*?[:\-]\s*/, "").replace(/cufe.*/i, "").trim();
      if (current && !isCufe(current)) return current;
    }
  }
  const middleLines = lines.slice(2, 6).filter((l) => !isCufe(l) && l.length > 3);
  return middleLines[0]?.trim() || null;
}

// ─── TIPO DE FACTURA ──────────────────────────────────────────────────────────
function detectTipoFactura(text: string, lines: string[]): string | null {
  // Electrónica
  if (
    text.includes("FACTURA ELECTR") ||
    text.includes("CUFE") ||
    text.includes("CODIGO UNICO") ||
    text.includes("DIAN") ||
    text.includes("HABILITACI") ||
    /\bFE\b/.test(text)
  )
    return "Electrónica";

  // POS (ticket de caja)
  if (
    text.includes("TICKET") ||
    text.includes("SISTEMA POS") ||
    text.includes("NO SOPORTE FISCAL") ||
    (text.includes("DOCUMENTO EQUIVALENTE") && text.includes("POS")) ||
    lines.some((l) => /^\*{3,}/.test(l)) // típico separador de ticket POS
  )
    return "POS";

  // Equivalente
  if (
    text.includes("DOCUMENTO EQUIVALENTE") ||
    text.includes("DOC. EQUIVALENTE") ||
    text.includes("TIQUETE DE MAQUINA")
  )
    return "Equivalente";

  // Cuenta de cobro
  if (text.includes("CUENTA DE COBRO")) return "Cuenta de Cobro";

  // Servicios públicos
  if (
    text.includes("FACTURA DE SERVICIO") ||
    text.includes("SERVICIO PUBLICO") ||
    text.includes("EMPRESAS PUBLICAS") ||
    text.includes("ACUEDUCTO") ||
    text.includes("ELECTRICIDAD") ||
    text.includes("GAS NATURAL")
  )
    return "Servicios Públicos";

  // A mano / Talonario (sin indicadores electrónicos)
  if (text.includes("TALONARIO") || text.includes("RECIBO DE CAJA")) return "Talonario";

  return null; // El usuario selecciona manualmente
}

// ─── SERVICIO DECLARADO ───────────────────────────────────────────────────────
function detectServicio(text: string): string | null {
  // Parqueadero
  if (
    text.includes("PARQUEADERO") ||
    text.includes("PARKING") ||
    text.includes("ESTACIONAMIENTO") ||
    text.includes("PARQUEO")
  )
    return "Parqueadero";

  // Peajes
  if (
    text.includes("PEAJE") ||
    text.includes("CONCESION") ||
    text.includes("AUTOPISTA") ||
    text.includes("PEAJES")
  )
    return "Peajes";

  // Gasolina / Combustible
  if (
    text.includes("GASOLINA") ||
    text.includes("COMBUSTIBLE") ||
    text.includes("ACPM") ||
    text.includes("DIESEL") ||
    text.includes("GAS NATURAL VEHICULAR") ||
    text.includes("ESTACION DE SERVICIO") ||
    text.includes("PETROLEO") ||
    text.includes("GALONES")
  )
    return "Gasolina";

  // Alimentación
  if (
    text.includes("RESTAURANTE") ||
    text.includes("ALMUERZO") ||
    text.includes("COMIDA") ||
    text.includes("DESAYUNO") ||
    text.includes("CENA") ||
    text.includes("CAFE") ||
    text.includes("PANADERIA") ||
    text.includes("SUPERMERCADO") ||
    text.includes("PLAZA DE MERCADO") ||
    text.includes("FRUTAS") ||
    text.includes("CARNES") ||
    text.includes("ALIMENTOS")
  )
    return "Alimentación";

  // Hospedaje / Hoteles
  if (
    text.includes("HOTEL") ||
    text.includes("HOSTAL") ||
    text.includes("HOSPEDAJE") ||
    text.includes("ALOJAMIENTO") ||
    text.includes("HABITACION") ||
    text.includes("MOTEL")
  )
    return "Hospedaje";

  // IVA Hoteles
  if (text.includes("IVA") && (text.includes("HOTEL") || text.includes("HOSPEDAJE"))) {
    return "IVA Hoteles";
  }

  // Transporte
  if (
    text.includes("TRANSPORTE") ||
    text.includes("TAXI") ||
    text.includes("UBER") ||
    text.includes("REMESA") ||
    text.includes("FLETE") ||
    text.includes("ENCOMIENDA") ||
    text.includes("SERVICIO DE TRANSPORTE")
  )
    return "Transporte";

  // Lavadero
  if (
    text.includes("LAVADERO") ||
    text.includes("LAVADO") ||
    text.includes("CAR WASH") ||
    text.includes("LAVADO DE VEHICULO") ||
    text.includes("LAVAUTO")
  )
    return "Lavadero";

  // Llantera
  if (
    text.includes("LLANTA") ||
    text.includes("LLANTERA") ||
    text.includes("NEUMATICO") ||
    text.includes("VULCANIZADORA") ||
    text.includes("PINCHADO") ||
    text.includes("MONTALLANTAS")
  )
    return "Llantera";

  // Papelería
  if (
    text.includes("PAPELERIA") ||
    text.includes("PAPELERÍA") ||
    text.includes("UTILES DE OFICINA") ||
    text.includes("PAPELES") ||
    text.includes("LIBRERIA")
  )
    return "Papelería";

  // Gastos bancarios
  if (
    text.includes("BANCO") ||
    text.includes("BANCARIO") ||
    text.includes("COMISION BANCARIA") ||
    text.includes("TRANSFERENCIA") ||
    text.includes("TRANSACCION")
  )
    return "Gastos Bancarios";

  // Pago a proveedores
  if (
    text.includes("PROVEEDOR") ||
    text.includes("MATERIALES") ||
    text.includes("FERRETERIA") ||
    text.includes("ELECTRICIDAD") ||
    text.includes("INSUMOS") ||
    text.includes("REPUESTOS")
  )
    return "Pago a proveedores";

  return null; // El usuario selecciona manualmente
}

// ─── CIUDAD ───────────────────────────────────────────────────────────────────
function normalizarCiudad(raw: string): string {
  const v = raw.toLowerCase();
  if (v.includes("bogot")) return "Bogotá";
  if (v.includes("barranquilla")) return "Barranquilla";
  if (v.includes("cartagena")) return "Cartagena";
  if (v.includes("santa marta")) return "Santa Marta";
  if (v.includes("funza")) return "Funza";
  if (v.includes("galapa")) return "Galapa";
  return raw.trim();
}

function extractCiudad(text: string): string | null {
  const upper = text.toUpperCase();
  const ciudades: [string, string][] = [
    ["SANTA MARTA", "Santa Marta"],
    ["BARRANQUILLA", "Barranquilla"],
    ["CARTAGENA", "Cartagena"],
    ["BOGOTA", "Bogotá"],
    ["BOGOTÁ", "Bogotá"],
    ["FUNZA", "Funza"],
    ["GALAPA", "Galapa"],
    ["MEDELLIN", "Medellín"],
    ["CALI", "Cali"],
    ["BUCARAMANGA", "Bucaramanga"],
    ["VALLEDUPAR", "Valledupar"],
    ["SOLEDAD", "Soledad"],
    ["MALAMBO", "Malambo"],
  ];
  for (const [key, label] of ciudades) {
    if (upper.includes(key)) return label;
  }
  for (const part of text.split(/[\n,]/)) {
    const n = normalizarCiudad(part);
    if (n !== part.trim() && n.length > 1) return n;
  }
  const fromFull = normalizarCiudad(text);
  if (fromFull !== text.trim()) return fromFull;
  return null;
}
