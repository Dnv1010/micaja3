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

• numero_factura: Consecutivo/identificador único. ES OBLIGATORIO EXTRAERLO — siempre aparece en la factura, aunque no tenga etiqueta clara.
  Etiquetas que puede tener: "Factura", "Factura No.", "Factura N°", "No.", "Núm.", "Número", "N°", "Nº", "Nro", "Nro.", "FE", "FES", "FEV", "FV", "FC", "FA", "FACT", "FP", "Consecutivo", "Orden de venta", "Cta Cobro", "Recibo No.", "Ticket", "Documento".
  Puede aparecer al tope de la factura, al lado del código QR, o cerca de "Fecha de emisión". A veces viene sin etiqueta junto a un código de barras.
  Puede ser alfanumérico con prefijo (FE-), numérico largo, o corto.
  Si hay un "CUFE" y un "Factura No."/"N°" — toma el "Factura No.", NO el CUFE (el CUFE es hash largo hex).
  Si hay un número largo en formato 0987654321 al tope o cerca del logo, probablemente es el número de factura.
  Ejemplos válidos: "FE-12345", "FES97000001", "FV001234", "VAB-123", "39821007", "1234567", "SETT970000045", "FC1-450", "45300002156".

• fecha: Fecha de EMISIÓN (no vencimiento ni entrega). Etiquetas: "Fecha", "Fecha factura", "Fecha emisión", "Fecha expedición", "Emitida", "Fecha de venta".
  Formato salida: DD/MM/YYYY. Si está en otro formato, conviértelo.
  Ejemplos: "20/04/2026", "05/03/2026".

• valor: TOTAL A PAGAR, entero en pesos colombianos (COP). Etiquetas en orden de preferencia:
  "Total a pagar" > "Total factura" > "Total general" > "Gran total" > "Valor total" > "Neto a pagar" > "Total" (al final de la tabla de items).
  NUNCA uses: "Subtotal", "Base gravable", "IVA", "Descuento", "Cambio", "Vuelto", "Propina", "Sugerida", "Efectivo recibido", "Forma de pago".
  Si hay tabla de items, el total suele ser el valor MÁS GRANDE al final en negrita.

  REGLA DE DECIMALES (crítica — no inflar el número):
  En Colombia usan tanto formato europeo (7.200,00) como americano (7,200.00). El último grupo DE 1 O 2 DÍGITOS separado por coma/punto son CENTAVOS y se DESCARTAN.
    "7.200"        → 7200   (miles, sin decimales)
    "7.200,00"     → 7200   (miles + centavos .00, DESCARTAR los ,00)
    "7.200,50"     → 7200   (miles + centavos ,50, DESCARTAR)
    "7,200.00"     → 7200   (formato US, DESCARTAR el .00)
    "7,200"        → 7200   (miles en formato US)
    "1.234.567"    → 1234567 (solo miles)
    "1.234.567,00" → 1234567 (miles + centavos ,00, DESCARTAR)
    "1,234,567.50" → 1234567 (formato US, DESCARTAR el .50)
    "26500"        → 26500  (sin separadores)
    "26.500"       → 26500  (no es 26 con 500 decimales; son miles)
  Regla mental: cuenta SOLO los dígitos ANTES del ÚLTIMO separador que tenga 1-2 dígitos detrás. Si ese último grupo tiene 3 dígitos, son miles, inclúyelo.
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
        // Auth errors (401/403): todos los modelos fallarán, salir
        const authError = res.status === 401 || res.status === 403;
        console.error(`[gemini ocr ${modelo}] ${msg}`);
        if (authError) return null;
        // Cualquier otro error (404 modelo no disponible, 429 rate limit, 503 overload,
        // 400 bad request, etc.) → intentar con el siguiente modelo
        continue;
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
