const fs = require("fs");
const f = "app/api/telegram/webhook/route.ts";
let c = fs.readFileSync(f, "utf8");

// Buscar el bloque OCR.Space (primer intento) y Gemini (segundo intento)
// Vamos a reemplazar toda la seccion de OCR

const ocrStart = '      let textoOCR = "";';
const ocrEnd = '      if (!textoOCR.trim() || textoOCR.trim().length < 10) {';

const idxStart = c.indexOf(ocrStart);
const idxEnd = c.indexOf(ocrEnd);

if (idxStart === -1 || idxEnd === -1) {
  console.log("ERROR: no encontre los marcadores", idxStart, idxEnd);
  process.exit(1);
}

const newOcrBlock = `      let textoOCR = "";

      // Gemini Vision (primario)
      const geminiKey = process.env.GEMINI_API_KEY?.trim();
      if (geminiKey) {
        try {
          const geminiRes = await fetch(
            \`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=\${encodeURIComponent(geminiKey)}\`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      { inline_data: { mime_type: mimeType, data: base64 } },
                      { text: "Extrae el texto completo de esta factura colombiana. Incluye: NIT, raz\\u00f3n social, n\\u00famero de factura, fecha, valor total, y cualquier otro dato visible. Responde solo con el texto extra\\u00eddo, sin explicaciones." },
                    ],
                  },
                ],
                generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
              }),
            }
          );
          const geminiData = (await geminiRes.json()) as {
            candidates?: { content?: { parts?: { text?: string }[] } }[];
          };
          textoOCR = geminiData.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text?.trim() || "";
        } catch {
          textoOCR = "";
        }
      }

      // OCR.Space (respaldo si Gemini falla)
      if (!textoOCR.trim() || textoOCR.trim().length < 20) {
        try {
          const ocrForm = new FormData();
          ocrForm.append("base64Image", base64DataUrl);
          ocrForm.append("apikey", process.env.OCR_SPACE_API_KEY || "helloworld");
          ocrForm.append("language", "spa");
          ocrForm.append("isOverlayRequired", "false");
          ocrForm.append("OCREngine", "2");
          const ocrRes = await fetch("https://api.ocr.space/parse/image", { method: "POST", body: ocrForm });
          const ocrData = (await ocrRes.json()) as {
            IsErrored?: boolean;
            ParsedResults?: { ParsedText?: string }[];
          };
          if (!ocrData.IsErrored && ocrData.ParsedResults?.[0]?.ParsedText) {
            textoOCR = String(ocrData.ParsedResults[0].ParsedText);
          }
        } catch {
          textoOCR = "";
        }
      }

`;

c = c.substring(0, idxStart) + newOcrBlock + c.substring(idxEnd);

fs.writeFileSync(f, c, "utf8");
console.log("ok - Gemini primario, OCR.Space respaldo");
