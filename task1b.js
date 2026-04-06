const fs = require("fs");
const f = "app/api/telegram/webhook/route.ts";
let c = fs.readFileSync(f, "utf8");

// Agregar import de parseGeminiJson si no existe
if (!c.includes("parseGeminiJson")) {
  c = c.replace(
    'import { parseFacturaText } from "@/lib/factura-parser";',
    'import { parseFacturaText, parseGeminiJson } from "@/lib/factura-parser";'
  );
  // Si no tiene ese import exacto, buscar variante
  if (!c.includes("parseGeminiJson")) {
    c = c.replace(
      /import \{([^}]*parseFacturaText[^}]*)\} from "@\/lib\/factura-parser";/,
      (match, g1) => `import {${g1}, parseGeminiJson } from "@/lib/factura-parser";`
    );
  }
}

// Ahora reemplazar el bloque OCR completo
// Buscar desde "let textoOCR" o "let datos" hasta "const datos = parseFacturaText"
// Estrategia: reemplazar desde el primer intento de OCR hasta donde se usa "datos"

const geminiStart = c.indexOf("// Gemini Vision (primario)");
const altStart = c.indexOf("let textoOCR = \"\";");
const ocrBlockStart = geminiStart !== -1 ? geminiStart : altStart;

// Buscar donde termina el bloque OCR y empieza el uso de datos
const datosLine = c.indexOf("const datos = parseFacturaText(textoOCR);");

if (ocrBlockStart === -1 || datosLine === -1) {
  console.log("SKIP: no encontre marcadores OCR. gemini:", geminiStart, "alt:", altStart, "datos:", datosLine);
  process.exit(0);
}

// Encontrar el inicio real (la linea anterior al bloque)
const beforeOcr = c.lastIndexOf("\n", ocrBlockStart);
const afterDatos = c.indexOf("\n", datosLine) + 1;

const newOcrBlock = `
      // --- OCR: Gemini JSON (primario) + OCR.Space texto (fallback) ---
      let datos: ReturnType<typeof parseFacturaText> | null = null;

      const geminiKey = process.env.GEMINI_API_KEY?.trim();
      if (geminiKey) {
        try {
          const geminiRes = await fetch(
            \`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=\${encodeURIComponent(geminiKey)}\`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{
                  parts: [
                    { inline_data: { mime_type: mimeType, data: base64 } },
                    { text: "Eres un analista contable experto procesando facturas colombianas. Extrae la informacion de esta imagen y devuelve ESTRICTAMENTE un objeto JSON.\\n\\nReglas:\\n- \\"proveedor\\": Razon social del que VENDE (arriba, cerca del logo). NUNCA debe ser \\"Factura electronica de venta\\".\\n- \\"nit\\": NIT del PROVEEDOR (el que vende). Busca \\"NIT\\" o \\"N.I.T\\". NO pongas el NIT de BIA Energy (901588412 o 901588413).\\n- \\"numero_factura\\": Prefijo y numero. Busca \\"Factura\\", \\"FE\\", \\"FV\\", \\"Venta\\", \\"No.\\".\\n- \\"fecha\\": Fecha de emision en DD/MM/YYYY.\\n- \\"valor\\": Valor TOTAL final a pagar. Solo numero entero en pesos colombianos. Puntos y comas son miles (7.200=7200). Ignora centavos.\\n- \\"a_nombre_de_bia\\": true si el CLIENTE es BIA Energy o NIT 901588412/901588413.\\n- \\"ciudad\\": Ciudad que aparezca.\\n- \\"tipo_factura\\": Uno de: Electronica, POS, Equivalente, Talonario, Cuenta de Cobro, Servicios Publicos, o null.\\n- \\"servicio\\": Categoria: Parqueadero, Peajes, Gasolina, Alimentacion, Hospedaje, Transporte, Lavadero, Llantera, Papeleria, Pago a proveedores, o null.\\n- \\"descripcion\\": Concepto del servicio/producto.\\n\\nJSON:\\n{\\"proveedor\\":\\"\\",\\"nit\\":\\"\\",\\"numero_factura\\":\\"\\",\\"fecha\\":\\"DD/MM/YYYY\\",\\"valor\\":0,\\"a_nombre_de_bia\\":false,\\"ciudad\\":\\"\\",\\"tipo_factura\\":\\"\\",\\"servicio\\":\\"\\",\\"descripcion\\":\\"\\"}" },
                  ],
                }],
                generationConfig: { temperature: 0.1, maxOutputTokens: 1024, response_mime_type: "application/json" },
              }),
            }
          );
          const geminiData = (await geminiRes.json()) as {
            candidates?: { content?: { parts?: { text?: string }[] } }[];
          };
          const geminiText = geminiData.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text?.trim() || "";
          if (geminiText) {
            datos = parseGeminiJson(geminiText);
          }
        } catch {
          datos = null;
        }
      }

      // Fallback: OCR.Space + regex
      if (!datos || (!datos.monto_factura && !datos.razon_social)) {
        let textoOCR = "";
        try {
          const ocrForm = new FormData();
          ocrForm.append("base64Image", base64DataUrl);
          ocrForm.append("apikey", process.env.OCR_SPACE_API_KEY || "helloworld");
          ocrForm.append("language", "spa");
          ocrForm.append("isOverlayRequired", "false");
          ocrForm.append("OCREngine", "2");
          const ocrRes = await fetch("https://api.ocr.space/parse/image", { method: "POST", body: ocrForm });
          const ocrData = (await ocrRes.json()) as { IsErrored?: boolean; ParsedResults?: { ParsedText?: string }[] };
          if (!ocrData.IsErrored && ocrData.ParsedResults?.[0]?.ParsedText) {
            textoOCR = String(ocrData.ParsedResults[0].ParsedText);
          }
        } catch { textoOCR = ""; }
        if (textoOCR.trim().length >= 10) {
          datos = parseFacturaText(textoOCR);
        }
      }

      if (!datos || (!datos.monto_factura && !datos.razon_social && !datos.nit_factura)) {
        const appUrl = escHtml(\`\${serverBaseUrl()}/facturas/nueva\`);
        await enviarTelegram(chatId, "\\u274c No pude leer la factura.\\n\\n\\ud83d\\udca1 Consejos:\\n\\u00b7 Imagen bien iluminada\\n\\u00b7 Sin sombras\\n\\u00b7 Foto enfocada\\n\\nO sube en la app: " + appUrl);
        return NextResponse.json({ ok: true });
      }

`;

c = c.substring(0, beforeOcr + 1) + newOcrBlock + c.substring(afterDatos);

// Quitar el viejo bloque de "no pude leer" que ya no aplica (si quedo duplicado)
const oldErrorBlock = c.indexOf("if (!textoOCR.trim() || textoOCR.trim().length < 10)");
if (oldErrorBlock !== -1 && oldErrorBlock > c.indexOf("parseGeminiJson")) {
  const oldErrorEnd = c.indexOf("return NextResponse.json({ ok: true });\n      }\n", oldErrorBlock);
  if (oldErrorEnd !== -1) {
    c = c.substring(0, oldErrorBlock) + c.substring(oldErrorEnd + "return NextResponse.json({ ok: true });\n      }\n".length);
  }
}

fs.writeFileSync(f, c, "utf8");
console.log("ok - webhook OCR actualizado");
console.log("tiene parseGeminiJson import:", c.includes("parseGeminiJson"));
console.log("tiene response_mime_type:", c.includes("response_mime_type"));
