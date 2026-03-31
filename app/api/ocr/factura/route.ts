import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Readable } from "stream";
import { authOptions } from "@/lib/auth-options";
import { drive, assertSheetsConfigured } from "@/lib/google-sheets";
import { parseFacturaText } from "@/lib/factura-parser";

async function extractFileFromRequest(
  req: NextRequest
): Promise<{ buffer: Buffer; name: string; mimeType: string } | null> {
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = (await req.json()) as {
      base64?: string;
      filename?: string;
      mimeType?: string;
    };
    const base64 = String(body.base64 || "");
    if (!base64) return null;
    const pure = base64.includes(",") ? base64.split(",")[1] : base64;
    return {
      buffer: Buffer.from(pure, "base64"),
      name: body.filename || `factura_${Date.now()}.jpg`,
      mimeType: body.mimeType || "image/jpeg",
    };
  }

  const formData = await req.formData();
  const file = formData.get("factura") as File | null;
  if (!file) return null;
  const bytes = await file.arrayBuffer();
  return {
    buffer: Buffer.from(bytes),
    name: file.name,
    mimeType: file.type || "image/jpeg",
  };
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    assertSheetsConfigured();
    const folderId = process.env.GOOGLE_DRIVE_FACTURAS_FOLDER_ID;
    if (!folderId) {
      return NextResponse.json(
        { error: "Falta GOOGLE_DRIVE_FACTURAS_FOLDER_ID" },
        { status: 500 }
      );
    }

    const fileData = await extractFileFromRequest(req);
    if (!fileData) {
      return NextResponse.json({ error: "No se proporcionó archivo" }, { status: 400 });
    }
    const { buffer, name, mimeType } = fileData;

    const driveResponse = await drive!.files.create({
      requestBody: {
        name: `factura_${Date.now()}_${name}`,
        parents: [folderId],
      },
      media: {
        mimeType,
        body: Readable.from(buffer),
      },
      fields: "id, webViewLink",
    });

    await drive!.permissions.create({
      fileId: driveResponse.data.id!,
      requestBody: { role: "reader", type: "anyone" },
    });

    const imageUrl = `https://drive.google.com/uc?export=view&id=${driveResponse.data.id}`;

    const ocrKey = process.env.OCR_SPACE_API_KEY;
    if (!ocrKey) {
      return NextResponse.json(
        { error: "Falta OCR_SPACE_API_KEY" },
        { status: 500 }
      );
    }

    const ocrFormData = new FormData();
    const bytes = new Uint8Array(buffer);
    ocrFormData.append("file", new Blob([bytes], { type: mimeType }), name);
    ocrFormData.append("language", "spa");
    ocrFormData.append("isOverlayRequired", "false");
    ocrFormData.append("OCREngine", "2");
    ocrFormData.append("isTable", "true");
    ocrFormData.append("scale", "true");
    ocrFormData.append("detectOrientation", "true");

    const ocrResponse = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      headers: { apikey: ocrKey },
      body: ocrFormData,
    });

    const ocrResult = await ocrResponse.json();

    if (ocrResult.IsErroredOnProcessing) {
      throw new Error(ocrResult.ErrorMessage?.[0] || "Error en OCR.Space");
    }

    const fullText =
      ocrResult.ParsedResults?.map((r: { ParsedText?: string }) => r.ParsedText).join("\n") || "";

    if (!fullText.trim()) {
      return NextResponse.json({
        success: true,
        data: {
          raw_text: "",
          num_factura: null,
          fecha_factura: null,
          monto_factura: null,
          nit_factura: null,
          razon_social: null,
          nombre_bia: false,
          ciudad: null,
          descripcion: null,
          image_url: imageUrl,
          drive_file_id: driveResponse.data.id,
          ocr_confidence: 0,
          message:
            "No se pudo leer texto de la imagen. Intenta con una foto más nítida.",
        },
      });
    }

    const extractedData = parseFacturaText(fullText);
    const confidence = ocrResult.ParsedResults?.[0]?.TextOverlay?.Lines
      ? Math.round(
          ocrResult.ParsedResults[0].TextOverlay.Lines.reduce(
            (acc: number, line: { MaxHeight?: number }) => acc + (line.MaxHeight || 0),
            0
          ) / ocrResult.ParsedResults[0].TextOverlay.Lines.length
        )
      : null;

    return NextResponse.json({
      success: true,
      data: {
        ...extractedData,
        raw_text: fullText,
        image_url: imageUrl,
        drive_file_id: driveResponse.data.id,
        ocr_confidence: confidence,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error OCR:", error);
    return NextResponse.json(
      { error: "Error procesando factura", details: message },
      { status: 500 }
    );
  }
}
