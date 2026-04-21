export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { runOcrSpace } from "@/lib/ocr-space";
import { runGeminiOcr } from "@/lib/gemini-factura-prompt";
import { parseGeminiJson } from "@/lib/factura-parser";

type GastoOcr = {
  proveedor: string | null;
  nit: string | null;
  numFactura: string | null;
  concepto: string | null;
  valor: string | null;
  fecha: string | null;
};

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = (await req.json().catch(() => ({}))) as { imageBase64?: string; mimeType?: string };
    const imageBase64 = String(body.imageBase64 || "").trim();
    const mimeType = String(body.mimeType || "image/jpeg");
    if (!imageBase64) return NextResponse.json({ error: "Envía imageBase64" }, { status: 400 });

    const jsonText = await runGeminiOcr(imageBase64, mimeType);
    if (jsonText) {
      try {
        const d = parseGeminiJson(jsonText);
        const data: GastoOcr = {
          proveedor: d.razon_social,
          nit: d.nit_factura,
          numFactura: d.num_factura,
          concepto: d.descripcion,
          valor: d.monto_factura != null ? String(Math.round(d.monto_factura)) : null,
          fecha: d.fecha_factura,
        };
        return NextResponse.json({ success: true, data });
      } catch (e) {
        console.error("[ia/ocr] parseGeminiJson fallo:", e);
      }
    }

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
