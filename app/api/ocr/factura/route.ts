import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { runOcrSpace } from "@/lib/ocr-space";
import { runGeminiOcr } from "@/lib/gemini-factura-prompt";
import { parseGeminiJson } from "@/lib/factura-parser";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    const body = (await req.json()) as {
      imageUrl?: string;
      imageBase64?: string;
      mimeType?: string;
      filename?: string;
    };
    const imageUrl = String(body.imageUrl || "").trim();
    let imageBase64 = String(body.imageBase64 || "").trim();
    const mimeType = String(body.mimeType || "image/jpeg");

    if (!imageUrl && !imageBase64) {
      return NextResponse.json({ error: "Indique imageUrl o imageBase64" }, { status: 400 });
    }

    if (imageUrl && !imageBase64) {
      let fetchUrl = imageUrl;
      const m = imageUrl.match(/\/d\/([^/]+)/) || imageUrl.match(/[?&]id=([^&]+)/);
      if (m?.[1]) fetchUrl = `https://drive.google.com/uc?export=download&id=${m[1]}`;
      const imgRes = await fetch(fetchUrl);
      const buf = await imgRes.arrayBuffer();
      imageBase64 = Buffer.from(buf).toString("base64");
    }

    let data: Record<string, unknown> = {};
    const geminiJson = await runGeminiOcr(imageBase64, mimeType);
    if (geminiJson) {
      try {
        // Convertimos al shape FacturaData usando parseGeminiJson (acepta llaves cortas y largas)
        data = parseGeminiJson(geminiJson) as unknown as Record<string, unknown>;
      } catch (e) {
        console.error("[ocr/factura] parseGeminiJson fallo:", e);
      }
    }

    // Fallback OCR.Space si Gemini no devolvió nada útil
    if (!data || (!data.monto_factura && !data.razon_social && !data.nit_factura)) {
      const result = await runOcrSpace({
        imageUrl: imageUrl || undefined,
        imageBase64: imageUrl ? undefined : imageBase64,
        mimeType,
        filename: body.filename,
      });
      data = (result.extracted as unknown as Record<string, unknown>) || {};
    }

    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error("[ocr/factura]", e);
    return NextResponse.json({ success: false, data: {} }, { status: 500 });
  }
}
