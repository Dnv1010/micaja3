/**
 * Prompt y helper para extracción OCR de facturas colombianas vía Gemini.
 * Usado por /api/ocr/factura, /api/ia/ocr y el bot Telegram.
 */

export const GEMINI_FACTURA_PROMPT_CORE = `Eres un experto extrayendo datos de facturas colombianas (electrónicas, POS, equivalentes, a mano, servicios).

Devuelve SOLO JSON valido (sin markdown, sin explicaciones, sin backticks).

REGLA #1 — DOS PARTES DE LA FACTURA (no las confundas):
- PROVEEDOR / VENDEDOR: quien VENDE. Arriba, cerca del logo, nombre grande + SU NIT. Lo que queremos.
- CLIENTE / COMPRADOR / ADQUIRIENTE: quien COMPRA. Aparece en "Señor(es)", "Cliente", "Facturado a", "Razón Social Cliente", "Adquiriente". Siempre es BIA Energy.

BIA ENERGY S.A.S. ESP (NIT 901588412 / 901588413 / 901.588.413-2) es SIEMPRE el CLIENTE, NUNCA el proveedor. Si lo detectas, \`a_nombre_de_bia\`=true pero NO lo uses como proveedor.

REGLA #2 — COMO EXTRAER CADA CAMPO:

• proveedor: Razón social del VENDEDOR. Suele estar al tope con el logo. También aparece junto al NIT del proveedor (encima, abajo o al lado). Devuelve en mayúsculas tal cual aparece, sin "NIT", sin cédula.
  Ejemplos válidos: "PARCHEGGIO S.A.S", "EDS PETROMIL SANTA MARTA", "CLARO COMUNICACIONES S.A.", "OLIMPICA S.A", "HOTEL DANN CARLTON".

• nit: NIT del VENDEDOR (no de BIA). Etiquetas: "NIT", "NIT.", "N.I.T.", "Nit:", "RUT", "Identificación", "No. identificación".
  Formato de salida: 9 dígitos opcionalmente con DV: "900123456" o "900.123.456-7". Normaliza puntos y guiones.
  Ejemplos: "901637465", "800.103.052-1", "860.510.669-0".

• numero_factura: Consecutivo. Etiquetas: "Factura", "Factura No.", "No.", "Número", "N°", "Nº", "Nro", "FE", "FV", "FC", "FA", "Consecutivo", "Orden de venta".
  Puede ser alfanumérico. Ejemplos: "FE-12345", "FV001234", "VAB-123", "39821007", "1234567".

• fecha: Fecha de EMISIÓN (no vencimiento ni entrega). Etiquetas: "Fecha", "Fecha factura", "Fecha emisión", "Fecha expedición", "Emitida", "Fecha de venta".
  Formato salida: DD/MM/YYYY. Si está en otro formato, conviértelo.
  Ejemplos: "20/04/2026", "05/03/2026".

• valor: TOTAL A PAGAR, entero en pesos colombianos (COP). Etiquetas en orden de preferencia:
  "Total a pagar" > "Total factura" > "Total general" > "Gran total" > "Valor total" > "Neto a pagar" > "Total" (al final de la tabla de items).
  NUNCA uses: "Subtotal", "Base gravable", "IVA", "Descuento", "Cambio", "Vuelto", "Propina", "Sugerida", "Efectivo recibido", "Forma de pago".
  Si hay tabla de items, el total suele ser el valor MÁS GRANDE al final en negrita.
  Puntos y comas son separadores de miles. Ejemplos: "7.200" → 7200, "1.234.567" → 1234567, "26,500" → 26500 (miles, NO centavos).
  Si no hay etiqueta "Total" (típico en POS) pero hay un solo monto grande abajo-derecha, ese es el valor.

• a_nombre_de_bia: true si en la sección de CLIENTE aparece "BIA ENERGY" o el NIT 901588412 / 901588413. false en otro caso.

• ciudad: Ciudad de emisión. Busca en dirección del proveedor o etiqueta "Ciudad". Ejemplos válidos: "Bogotá", "Barranquilla", "Santa Marta", "Cartagena", "Funza", "Galapa". Si no es clara, null.

• tipo_factura: Una de exactamente: "Electrónica", "POS", "Equivalente", "Talonario", "A Mano", "Servicios Públicos", "Cuenta de Cobro". O null.

• servicio: Una de exactamente: "Parqueadero", "Peajes", "Gasolina", "Alimentación", "Hospedaje", "Transporte", "Lavadero", "Llantera", "Papelería", "Pago a proveedores", "IVA Hoteles", "Convenciones", "Eventos", "Gastos Bancarios", "Otro". O null.

• descripcion: Concepto del gasto en 1-3 palabras. Etiquetas: "Concepto", "Descripción", "Detalle", "Item", "Ítem", "Producto", "Servicio", "Artículo".
  Ejemplos: "Almuerzo ejecutivo", "Parqueadero 2 horas", "Peaje Calle 80", "Gasolina Corriente".

FORMATO DE SALIDA (exactamente estas llaves):
{"proveedor":"","nit":"","numero_factura":"","fecha":"","valor":0,"a_nombre_de_bia":false,"ciudad":"","tipo_factura":"","servicio":"","descripcion":""}

Si algún campo no se puede leer con certeza, usa "" para strings, null para números que no detectes. Pero haz lo posible por extraer TODOS los campos — son facturas estándar colombianas.`;

type GeminiResp = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  error?: { message?: string };
};

export interface GeminiOcrOptions {
  maxOutputTokens?: number;
}

/**
 * Ejecuta OCR sobre una imagen con Gemini, usando cascada de modelos:
 *   gemini-2.5-pro (mejor precisión) → 2.5-flash → 2.5-flash-lite → 2.0-flash-lite.
 * Devuelve el texto JSON tal cual o null si todos fallan.
 */
export async function runGeminiOcr(
  imageBase64: string,
  mimeType: string,
  opts: GeminiOcrOptions = {}
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;

  const modelos = [
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash-lite",
  ];
  const body = JSON.stringify({
    contents: [
      {
        parts: [
          { inline_data: { mime_type: mimeType, data: imageBase64 } },
          { text: GEMINI_FACTURA_PROMPT_CORE },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: opts.maxOutputTokens ?? 1024,
      responseMimeType: "application/json",
    },
  });

  for (const modelo of modelos) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${encodeURIComponent(apiKey)}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body }
      );
      const data = (await res.json()) as GeminiResp;
      if (!res.ok) {
        const msg = data?.error?.message || `HTTP ${res.status}`;
        const retryable =
          /overloaded|high demand|UNAVAILABLE|quota|rate.?limit|RESOURCE_EXHAUSTED/i.test(msg) ||
          res.status === 503 ||
          res.status === 429;
        console.error(`[gemini ocr ${modelo}] ${msg}`);
        if (retryable) continue;
        return null;
      }
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (text) {
        // Limpiar fences por si acaso
        return text.replace(/```json\n?/g, "").replace(/```/g, "").trim();
      }
    } catch (e) {
      console.error(`[gemini ocr ${modelo}] fetch:`, e);
    }
  }
  return null;
}
