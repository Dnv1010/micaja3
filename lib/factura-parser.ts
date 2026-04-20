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
  const found: string[] = [];

  // Patron 1: NIT explicito (NIT, Nit, NIT., NIT:, N.I.T)
  const p1 = /N\.?\s*I\.?\s*T\.?\s*[:\-.]?\s*([\d][\d.\s]{4,18}[\-]?\d?)/gi;
  let m: RegExpExecArray | null;
  while ((m = p1.exec(text)) !== null) {
    const clean = m[1].replace(/[.\-\s]/g, "");
    if (clean.length < 6) continue;
    const isBia = BIA_NITS.some((b) => clean.startsWith(b.replace(/[.\-]/g, "")));
    if (!isBia) found.push(m[1].trim());
  }
  if (found[0]) return found[0];

  // Patron 2: formato colombiano sin label NIT (XXX.XXX.XXX-X)
  const p2 = /\b(\d{3}\.\d{3}\.\d{3}[\-]\d{1})\b/g;
  while ((m = p2.exec(text)) !== null) {
    const clean = m[1].replace(/[.\-]/g, "");
    const isBia = BIA_NITS.some((b) => clean.startsWith(b.replace(/[.\-]/g, "")));
    if (!isBia) found.push(m[1].trim());
  }
  if (found[0]) return found[0];

  // Patron 3: numero largo despues de razon social (6-10 digitos con guion)
  const p3 = /(?:S\.?A\.?S|LTDA|S\.?A\.).*?\n.*?(\d{6,10}[\-]\d{1})/gi;
  while ((m = p3.exec(text)) !== null) {
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
// Prioridad: sinónimos de "total a pagar" > "total" genérico > COP > "subtotal" (fallback)
function extractMonto(text: string): number | null {
  const patterns = [
    // Total a pagar / Gran total / Total general / Valor total / Total factura / Neto a pagar / Valor a pagar / Pago total / Suma total
    /(?:TOTAL\s*A\s*PAGAR|GRAN\s*TOTAL|TOTAL\s*GENERAL|VALOR\s*TOTAL|TOTAL\s*FACTURA|NETO\s*A\s*PAGAR|VALOR\s*A\s*PAGAR|PAGO\s*TOTAL|SUMA\s*TOTAL|TOTAL\s*VENTA|TOTAL\s*OPERACI[OÓ]N)\s*[:\s]*(?:COP|\$)?\s*\$?\s*([\d.,]+)/i,
    // Pago / Pagar / A pagar (en línea propia, sin SUB)
    /(?:^|\s)(?:PAGO|PAGAR|A\s*PAGAR)\s*[:\s]*(?:COP|\$)?\s*\$?\s*([\d.,]+)/im,
    // Tarifa
    /(?:TARIFA\s*TOTAL|TARIFA)\s*[:\s]*(?:COP|\$)?\s*\$?\s*([\d.,]+)/i,
    // TOTAL genérico (no SUBTOTAL): exige no estar precedido de "SUB"
    /(?:^|[^A-Z])TOTAL\s*[:\s]*(?:COP|\$)?\s*\$?\s*([\d.,]+)/im,
    // VALOR a secas
    /(?:^|\s)VALOR\s*[:\s]*(?:COP|\$)?\s*\$?\s*([\d.,]+)/im,
    // COP explícito
    /COP\s*\$?\s*([\d.,]+)/i,
    // SUBTOTAL (último recurso)
    /SUBTOTAL\s*[:\s]*(?:COP|\$)?\s*([\d.,]+)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const num = parseCOPAmount(m[1].trim());
      // Primer patrón con match válido gana (están ordenados por prioridad).
      if (!isNaN(num) && num > 0) return num;
    }
  }
  return null;
}

/** Parsea montos colombianos: puntos y comas son miles, centavos se ignoran */
function parseCOPAmount(raw: string): number {
  // Quitar espacios
  let s = raw.trim();
  // Si termina en ,XX o .XX (1-2 digitos) -> son centavos, quitar
  s = s.replace(/[.,]\d{1,2}$/, "");
  // Quitar todos los puntos y comas restantes (son miles)
  s = s.replace(/[.,]/g, "");
  const n = parseInt(s, 10);
  return isNaN(n) ? 0 : n;
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
    // Factura electronica de venta
    /(?:FACTURA\s*ELECTR[OÓ]NICA\s*(?:DE\s*)?VENTA)\s*(?:No\.?|N[°ÚU]MERO|#|:)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-]{1,20})/i,
    // VENTA sola
    /\bVENTA\s*(?:No\.?|N\.?|#|:)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-]{1,20})/i,
    // FEV, FES, FE, FV prefijos
    /\b(FE[VS]?\s*[\-]?\s*\d{1,15})\b/i,
    /\b(FV\s*[\-]?\s*\d{1,15})\b/i,
    /\b(FE\s*[\-]?\s*[A-Z0-9]{1,15})\b/i,
    // Factura No, N., No., #
    /(?:FACTURA|FACT)\s*(?:No\.?|N\.?|N[°ÚU]|#|:)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-]{1,20})/i,
    // No. o N. seguido de numero
    /(?:No\.?|N\.)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-]{1,20})/i,
    // # seguido de alfanumerico
    /#\s*([A-Z0-9][A-Z0-9\-]{1,20})/i,
    // RECIBO o TICKET
    /RECIBO\s*(?:No\.?|#|:)?\s*(\d{1,15})/i,
    /TICKET\s*(?:No\.?|#|:)?\s*(\d{1,15})/i,
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

// ─── DESCRIPCIÓN / CONCEPTO ───────────────────────────────────────────────────
function extractDescripcion(lines: string[], text: string): string | null {
  void text;

  const isCufe = (line: string) =>
    /^[a-f0-9]{20,}$/i.test(line.replace(/\s/g, "")) ||
    line.toLowerCase().startsWith("cufe") ||
    line.toLowerCase().startsWith("cude");

  const keywords = ["CONCEPTO", "DESCRIPCI", "DETALLE", "PRODUCTO", "ARTICULO", "ARTÍCULO", "ITEM", "ÍTEM", "SERVICIO"];
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
  if (/PARQUEADERO|PARKING|ESTACIONAMIENTO|PARQUEO|TARIFA\s*MOTOS?|TARIFA\s*CARROS?|TARIFA\s*VEHIC/i.test(text))
    return "Parqueadero";

  // Peajes
  if (/PEAJE|CONCESI[OÓ]N|AUTOPISTA/i.test(text))
    return "Peajes";

  // Gasolina / Combustible
  if (/GASOLINA|COMBUSTIBLE|ACPM|DIESEL|GAS\s*NATURAL\s*VEHIC|ESTACION\s*DE\s*SERVICIO|PETROLEO|GAL[OÓ]N/i.test(text))
    return "Gasolina";

  // Hospedaje
  if (/HOTEL|HOSTAL|HOSPEDAJE|ALOJAMIENTO|HABITACI[OÓ]N/i.test(text))
    return "Hospedaje";

  // Alimentacion (antes de transporte porque restaurantes pueden tener "servicio")
  if (/RESTAURANTE|ALMUERZO|COMIDA|DESAYUNO|CENA|PANADERI|SUPERMERCADO|PLAZA\s*DE\s*MERCADO|FRUTAS|CARNES|ALIMENTOS|SERVICIO\s*A\s*LA\s*MESA|POLLO|PIZZA|HAMBURGUESA|AREPA|EMPANADA|ASADERO|CAFETER[IÍ]A|SUSHI|COMIDAS\s*R[AÁ]PIDAS|BEBIDAS|JUGOS|HELAD|PASTEL|BAKERY|PARRILLA|BRASA|FRITANGA|BANDEJA|CORRIENTAZO|MENU\s*DEL\s*D[IÍ]A|BUFFET/i.test(text))
    return "Alimentación";

  // Transporte
  if (/TRANSPORTE|TAXI|UBER|REMESA|FLETE|ENCOMIENDA|ENV[IÍ]O|MENSAJER[IÍ]A|DIDI|INDRIVER|BEAT/i.test(text))
    return "Transporte";

  // Lavadero
  if (/LAVADERO|LAVADO|CAR\s*WASH|LAVAUTO|LAVAAUTOS/i.test(text))
    return "Lavadero";

  // Llantera
  if (/LLANTA|LLANTERA|NEUM[AÁ]TICO|VULCANIZADORA|PINCHADO|MONTALLANTAS/i.test(text))
    return "Llantera";

  // Papeleria
  if (/PAPELER[IÍ]A|[UÚ]TILES\s*DE\s*OFICINA|LIBRER[IÍ]A|IMPRESION|FOTOCOPIAS/i.test(text))
    return "Papelería";

  // Pago a proveedores / materiales
  if (/MATERIALES|FERRETER[IÍ]A|INSUMOS|REPUESTOS|HERRAMIENTAS|TORNILLOS|CABLES|TUBER[IÍ]A|CEMENTO|PINTURA|SOLDADURA|ELECTRI/i.test(text))
    return "Pago a proveedores";

  // Gastos bancarios
  if (/COMISI[OÓ]N\s*BANCARIA|TRANSFERENCIA\s*BANCARIA|TRANSACCI[OÓ]N\s*BANCARIA/i.test(text))
    return "Gastos Bancarios";

  // Servicios publicos
  if (/FACTURA\s*DE\s*SERVICIO|SERVICIO\s*P[UÚ]BLICO|EMPRESAS\s*P[UÚ]BLICAS|ACUEDUCTO|GAS\s*NATURAL(?!\s*VEHIC)/i.test(text))
    return "Servicios Públicos";

  return null;
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


/** Convierte el JSON de Gemini al tipo FacturaData. Lanza error si el JSON no es valido. */
/**
 * Acepta ambos formatos JSON que puede devolver Gemini:
 *  - corto: { proveedor, nit, numero_factura, valor, fecha, a_nombre_de_bia, servicio, ... }
 *  - largo: { razon_social, nit_factura, num_factura, monto_factura, fecha_factura, nombre_bia, servicio_declarado, ... }
 */
export function parseGeminiJson(raw: string): FacturaData {
  const obj = JSON.parse(raw) as Record<string, unknown>;
  const valorRaw = obj.valor ?? obj.monto_factura ?? obj.total ?? obj.monto;
  let monto = 0;
  if (typeof valorRaw === "number") {
    monto = valorRaw;
  } else if (typeof valorRaw === "string") {
    let s = String(valorRaw).trim();
    s = s.replace(/[.,]\d{1,2}$/, "");
    s = s.replace(/[.,]/g, "");
    monto = parseInt(s, 10) || 0;
  }
  const pick = (...keys: string[]): string | null => {
    for (const k of keys) {
      const v = obj[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return null;
  };
  const pickBool = (...keys: string[]): boolean => {
    for (const k of keys) {
      const v = obj[k];
      if (typeof v === "boolean") return v;
      if (typeof v === "string") return v.toLowerCase() === "true";
    }
    return false;
  };
  return {
    num_factura: pick("numero_factura", "num_factura"),
    fecha_factura: pick("fecha", "fecha_factura"),
    monto_factura: monto > 0 ? monto : null,
    nit_factura: pick("nit", "nit_factura"),
    razon_social: pick("proveedor", "razon_social"),
    nombre_bia: pickBool("a_nombre_de_bia", "nombre_bia"),
    ciudad: pick("ciudad"),
    descripcion: pick("descripcion", "concepto"),
    tipo_factura: pick("tipo_factura"),
    servicio_declarado: pick("servicio", "servicio_declarado"),
  };
}
