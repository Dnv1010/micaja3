export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { runOcrSpace } from "@/lib/ocr-space";

type GastoOcr = {
  proveedor: string | null;
  nit: string | null;
  numFactura: string | null;
  concepto: string | null;
  valor: string | null;
  fecha: string | null;
};

async function runGemini(imageBase64: string, mimeType: string): Promise<GastoOcr | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  const prompt = `Extrae los datos de esta factura colombiana y responde SOLO con JSON valido sin markdown ni backticks:
{"fecha_factura":"DD/MM/YYYY o null","razon_social":"nombre proveedor o null","nit_factura":"NIT formato 000.000.000-0 o null","num_factura":"numero factura o null","descripcion":"concepto o null","monto_factura":numero o null}`;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [
        { inline_data: { mime_type: mimeType, data: imageBase64 } },
        { text: prompt },
      ] }],
    }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const clean = text.replace(/```json|```/g, "").trim();
  if (!clean) return null;
  try {
    const d = JSON.parse(clean) as Record<string, unknown>;
    return {
      proveedor: (d.razon_social as string | null) ?? null,
      nit: (d.nit_factura as string | null) ?? null,
      numFactura: (d.num_factura as string | null) ?? null,
      concepto: (d.descripcion as string | null) ?? null,
      valor: d.monto_factura != null ? String(Math.round(Number(d.monto_factura))) : null,
      fecha: (d.fecha_factura as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = (await req.json().catch(() => ({}))) as { imageBase64?: string; mimeType?: string };
    const imageBase64 = String(body.imageBase64 || "").trim();
    const mimeType = String(body.mimeType || "image/jpeg");
    if (!imageBase64) return NextResponse.json({ error: "Envía imageBase64" }, { status: 400 });

    const gem = await runGemini(imageBase64, mimeType);
    if (gem) return NextResponse.json({ success: true, data: gem });

    const result = await runOcrSpace({ imageBase64, mimeType });
    const e = result.extracted;
    const data: GastoOcr = {
      proveedor: e.razon_social ?? null,
      nit: e.nit_factura ?? null,
      numFactura: e.num_factura ?? null,
      concepto: e.descripcion ?? null,
      valor: e.monto_factura != null ? String(Math.round(e.monto_factura)) : null,
      fecha: e.fecha_factura ?? null,
    };
    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error("[ia/ocr] ERROR:", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Error en OCR", data: { proveedor: null, nit: null, numFactura: null, concepto: null, valor: null, fecha: null } },
      { status: 500 }
    );
  }
}
