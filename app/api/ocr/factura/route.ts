import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Readable } from "stream";
import { authOptions } from "@/lib/auth-options";
import { drive, assertSheetsConfigured } from "@/lib/google-sheets";
import { parseFacturaText } from "@/lib/factura-parser";

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

    const formData = await req.formData();
    const file = formData.get("factura") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No se proporcionó archivo" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const driveResponse = await drive!.files.create({
      requestBody: {
        name: `factura_${Date.now()}_${file.name}`,
        parents: [folderId],
      },
      media: {
        mimeType: file.type || "image/jpeg",
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
    ocrFormData.append("file", new Blob([buffer], { type: file.type }), file.name);
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
