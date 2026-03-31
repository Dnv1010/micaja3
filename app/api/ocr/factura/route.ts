import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { runOcrSpace } from "@/lib/ocr-space";

/**
 * POST /api/ocr/factura
 * Body JSON: { imageUrl?: string, imageBase64?: string, mimeType?: string, filename?: string }
 * Prioridad: si hay imageUrl se usa URL en OCR.Space; si no, imageBase64.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      imageUrl?: string;
      imageBase64?: string;
      mimeType?: string;
      filename?: string;
    };

    const imageUrl = String(body.imageUrl || "").trim();
    const imageBase64 = String(body.imageBase64 || "").trim();

    if (!imageUrl && !imageBase64) {
      return NextResponse.json(
        { error: "Indique imageUrl o imageBase64" },
        { status: 400 }
      );
    }

    let fetchUrl = imageUrl;
    if (imageUrl && imageUrl.includes("drive.google.com")) {
      const m = imageUrl.match(/\/d\/([^/]+)/) || imageUrl.match(/[?&]id=([^&]+)/);
      if (m?.[1]) {
        fetchUrl = `https://drive.google.com/uc?export=download&id=${m[1]}`;
      }
    }

    const result = await runOcrSpace({
      imageUrl: imageUrl ? fetchUrl : undefined,
      imageBase64: imageUrl ? undefined : imageBase64,
      mimeType: body.mimeType,
      filename: body.filename,
    });

    if (result.isErrored) {
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
          image_url: imageUrl || null,
          drive_file_id: null,
          ocr_confidence: 0,
          message:
            result.errorMessage ||
            "No se pudieron extraer todos los datos. Completa los campos manualmente.",
        },
      });
    }

    const { extracted: d, fullText } = result;

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
          image_url: imageUrl || null,
          drive_file_id: null,
          ocr_confidence: 0,
          message: "No se pudieron extraer todos los datos. Completa los campos manualmente.",
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        num_factura: d.num_factura,
        fecha_factura: d.fecha_factura,
        monto_factura: d.monto_factura,
        nit_factura: d.nit_factura,
        razon_social: d.razon_social,
        nombre_bia: d.nombre_bia,
        ciudad: d.ciudad,
        descripcion: d.descripcion,
        raw_text: fullText,
        image_url: imageUrl || null,
        drive_file_id: null,
        ocr_confidence: null,
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
