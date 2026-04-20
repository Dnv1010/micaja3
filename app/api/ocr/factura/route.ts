import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { runOcrSpace } from "@/lib/ocr-space";

async function runGemini(imageBase64: string, mimeType: string) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("Sin GEMINI_API_KEY");
  const prompt = `Extrae los datos de esta factura colombiana y responde SOLO con JSON valido sin markdown ni backticks:
{"fecha_factura":"DD/MM/YYYY o null","razon_social":"nombre proveedor o null","nit_factura":"NIT formato 000.000.000-0 o null","num_factura":"numero factura o null","descripcion":"concepto o null","monto_factura":numero o null,"nombre_bia":true o false,"ciudad":"ciudad o null","tipo_factura":"tipo o null","servicio_declarado":"servicio o null"}`;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [
        { inline_data: { mime_type: mimeType, data: imageBase64 } },
        { text: prompt }
      ]}]
    })
  });
  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    const body = await req.json() as { imageUrl?: string; imageBase64?: string; mimeType?: string; filename?: string };
    const imageUrl = String(body.imageUrl || "").trim();
    let imageBase64 = String(body.imageBase64 || "").trim();
    const mimeType = String(body.mimeType || "image/jpeg");

    if (!imageUrl && !imageBase64) return NextResponse.json({ error: "Indique imageUrl o imageBase64" }, { status: 400 });

    if (imageUrl && !imageBase64) {
      let fetchUrl = imageUrl;
      const m = imageUrl.match(/\/d\/([^/]+)/) || imageUrl.match(/[?&]id=([^&]+)/);
      if (m?.[1]) fetchUrl = `https://drive.google.com/uc?export=download&id=${m[1]}`;
      const imgRes = await fetch(fetchUrl);
      const buf = await imgRes.arrayBuffer();
      imageBase64 = Buffer.from(buf).toString("base64");
    }

    let data: Record<string, unknown> = {};
    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    if (geminiKey) {
      try {
        data = await runGemini(imageBase64, mimeType);
      } catch (e) {
        console.error("[ocr] Gemini fallo, usando OCR.Space:", e);
        const result = await runOcrSpace({ imageBase64, mimeType, filename: body.filename });
        data = result.extracted as unknown as Record<string, unknown> || {};
      }
    } else {
      const result = await runOcrSpace({ imageUrl: imageUrl || undefined, imageBase64: imageUrl ? undefined : imageBase64, mimeType, filename: body.filename });
      data = result.extracted as unknown as Record<string, unknown> || {};
    }

    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error("[ocr/factura]", e);
    return NextResponse.json({ success: false, data: {} }, { status: 500 });
  }
}



