export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

async function runGemini(imageBase64: string, mimeType: string) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("Sin GEMINI_API_KEY");

  const prompt = `Extrae los datos de esta factura colombiana y responde SOLO con JSON válido sin markdown:
{"proveedor":"nombre proveedor o null","nit":"NIT formato 000.000.000-0 o null","numFactura":"número factura o null","concepto":"descripción o null","valor":numero o null,"fecha":"DD/MM/YYYY o null"}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mimeType, data: imageBase64 } },
            { text: prompt },
          ],
        }],
      }),
    }
  );

  const json = await res.json();
  console.log("[ia/ocr] Gemini status:", res.status);
  console.log("[ia/ocr] Gemini response:", JSON.stringify(json).slice(0, 500));

  if (!res.ok) {
    throw new Error(`Gemini error ${res.status}: ${json?.error?.message || JSON.stringify(json)}`);
  }

  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  if (!text) throw new Error(`Gemini sin texto. FinishReason: ${json?.candidates?.[0]?.finishReason || "unknown"}`);
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No se encontró JSON en la respuesta");
  return JSON.parse(match[0]);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = (await req.json().catch(() => ({}))) as {
      imageBase64?: string;
      mimeType?: string;
    };

    const imageBase64 = String(body.imageBase64 || "").trim();
    const mimeType = String(body.mimeType || "image/jpeg");

    if (!imageBase64) {
      return NextResponse.json({ error: "Envía imageBase64" }, { status: 400 });
    }

    const data = await runGemini(imageBase64, mimeType);

    return NextResponse.json({
      success: true,
      data: {
        proveedor: data.proveedor || null,
        nit: data.nit || null,
        numFactura: data.numFactura || null,
        concepto: data.concepto || null,
        valor: data.valor || null,
        fecha: data.fecha || null,
      },
    });
  } catch (e) {
    console.error("[ia/ocr] ERROR:", e instanceof Error ? e.message : e);
    return NextResponse.json(
      {
        success: false,
        error: e instanceof Error ? e.message : "Error en OCR",
        data: { proveedor: null, nit: null, numFactura: null, concepto: null, valor: null, fecha: null },
      },
      { status: 500 }
    );
  }
}