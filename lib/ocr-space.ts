import { parseFacturaText } from "@/lib/factura-parser";

const OCR_URL = "https://api.ocr.space/parse/image";

export type OcrSpaceResult = {
  fullText: string;
  extracted: ReturnType<typeof parseFacturaText>;
  isErrored: boolean;
  errorMessage?: string;
};

function stripBase64DataUrl(base64: string): string {
  const s = base64.trim();
  const i = s.indexOf("base64,");
  return i >= 0 ? s.slice(i + 7) : s;
}

/**
 * OCR.Space: envía URL pública o imagen en base64 (sin subir a Drive).
 */
export async function runOcrSpace(opts: {
  imageUrl?: string;
  imageBase64?: string;
  mimeType?: string;
  filename?: string;
}): Promise<OcrSpaceResult> {
  const apiKey = process.env.OCR_SPACE_API_KEY;
  if (!apiKey) {
    return {
      fullText: "",
      extracted: parseFacturaText(""),
      isErrored: true,
      errorMessage: "Falta OCR_SPACE_API_KEY",
    };
  }

  const form = new FormData();
  form.append("language", "spa");
  form.append("isOverlayRequired", "false");
  form.append("OCREngine", "2");
  form.append("isTable", "true");
  form.append("scale", "true");
  form.append("detectOrientation", "true");

  if (opts.imageUrl?.trim()) {
    form.append("url", opts.imageUrl.trim());
  } else if (opts.imageBase64?.trim()) {
    const pure = stripBase64DataUrl(opts.imageBase64);
    const mime = opts.mimeType || "image/jpeg";
    const withPrefix =
      mime.includes("pdf") ? `data:application/pdf;base64,${pure}` : `data:${mime};base64,${pure}`;
    form.append("base64Image", withPrefix);
  } else {
    return {
      fullText: "",
      extracted: parseFacturaText(""),
      isErrored: true,
      errorMessage: "Indique imageUrl o imageBase64",
    };
  }

  const ocrResponse = await fetch(OCR_URL, {
    method: "POST",
    headers: { apikey: apiKey },
    body: form,
  });

  const ocrResult = (await ocrResponse.json()) as {
    IsErroredOnProcessing?: boolean;
    ErrorMessage?: string[];
    ParsedResults?: { ParsedText?: string; TextOverlay?: { Lines?: { MaxHeight?: number }[] } }[];
  };

  if (ocrResult.IsErroredOnProcessing) {
    return {
      fullText: "",
      extracted: parseFacturaText(""),
      isErrored: true,
      errorMessage: ocrResult.ErrorMessage?.[0] || "Error en OCR.Space",
    };
  }

  const fullText =
    ocrResult.ParsedResults?.map((r) => r.ParsedText).join("\n") || "";
  const extracted = parseFacturaText(fullText);

  return {
    fullText,
    extracted,
    isErrored: false,
  };
}
