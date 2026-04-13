export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

async function runOcrSpace(imageBase64: string, mimeType: string) {
  const apiKey = process.env.OCR_SPACE_API_KEY?.trim();
  if (!apiKey) throw new Error("Sin OCR_SPACE_API_KEY");

  const body = new URLSearchParams();
  body.append("base64Image", `data:${mimeType};base64,${imageBase64}`);
  body.append("language", "spa");
  body.append("isOverlayRequired", "false");
  body.append("detectOrientation", "true");
  body.append("scale", "true");
  body.append("OCREngine", "2");

  const res = await fetch("https://api.ocr.space/parse/image", {
    method: "POST",
    headers: { apikey: apiKey },
    body,
  });

  const json = await res.json();
  if (json.IsErroredOnProcessing) throw new Error(json.ErrorMessage?.[0] || "OCR.Space error");

  const text = json.ParsedResults?.[0]?.ParsedText || "";
  if (!text) throw new Error("OCR no extrajo texto");

  return extraerDatosFactura(text);
}

function extraerDatosFactura(texto: string) {
  const lineas = texto.split("\n").map((l: string) => l.trim()).filter(Boolean);
  const nitMatch = texto.match(/NIT[:\s.]*([0-9]{3}[.\s]?[0-9]{3}[.\s]?[0-9]{3}[-.\s]?[0-9])/i);
  const valorMatch = texto.match(/(?:TOTAL|VALOR|A PAGAR|SUBTOTAL)[:\s$]*([0-9.,]+)/i);
  const facturaMatch = texto.match(/(?:FACTURA|FAC|FV|FC)[:\s#Nº°]*([A-Z0-9-]+)/i);
  const fechaMatch = texto.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
  return {
    proveedor: lineas[0] || null,
    nit: nitMatch ? nitMatch[1].replace(/\s/g, "") : null,
    numFactura: facturaMatch ? facturaMatch[1] : null,
    valor: valorMatch ? valorMatch[1].replace(/[.,]/g, "") : null,
    fecha: fechaMatch ? fechaMatch[1] : null,
    concepto: lineas.slice(1, 4).join(" ") || null,
  };
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = (await req.json().catch(() => ({}))) as { imageBase64?: string; mimeType?: string };
    const imageBase64 = String(body.imageBase64 || "").trim();
    const mimeType = String(body.mimeType || "image/jpeg");
    if (!imageBase64) return NextResponse.json({ error: "Envía imageBase64" }, { status: 400 });

    const data = await runOcrSpace(imageBase64, mimeType);
    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error("[ia/ocr] ERROR:", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Error en OCR", data: { proveedor: null, nit: null, numFactura: null, concepto: null, valor: null, fecha: null } },
      { status: 500 }
    );
  }
}