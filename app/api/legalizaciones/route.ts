import { NextRequest, NextResponse } from "next/server";
import { Readable } from "stream";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getDriveFacturasRootFolderId } from "@/lib/drive-env";
import { getDriveClient, SHEET_NAMES } from "@/lib/google-sheets";
import { appendSheetRow, getSheetData, rowsToObjects } from "@/lib/sheets-helpers";
import { buildAppendRow } from "@/lib/sheet-row";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";
import type { LegalizacionRow } from "@/types/models";

const LEG_HEADERS = [
  "ID",
  "Fecha",
  "Coordinador",
  "Zona",
  "Periodo",
  "TotalAprobado",
  "FacturasIds",
  "FirmaCoordinador",
  "PdfBase64",
  "PdfURL",
  "DatosPdfJSON",
  "Estado",
];

async function getLegalRowsWithHeaders(): Promise<string[][]> {
  const rows = await getSheetData("MICAJA", SHEET_NAMES.LEGALIZACIONES);
  if (!rows.length || !rows[0]?.some((c) => String(c || "").trim())) {
    await appendSheetRow("MICAJA", SHEET_NAMES.LEGALIZACIONES, LEG_HEADERS);
    return getSheetData("MICAJA", SHEET_NAMES.LEGALIZACIONES);
  }
  return rows;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const coordinadorQ = new URL(req.url).searchParams.get("coordinador")?.trim().toLowerCase() || "";
    const rows = await getLegalRowsWithHeaders();
    let data = rowsToObjects<LegalizacionRow>(rows);
    if (coordinadorQ) {
      data = data.filter(
        (r) => getCellCaseInsensitive(r, "Coordinador").toLowerCase() === coordinadorQ
      );
    }
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ data: [] });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const rol = String(session.user.rol || "user").toLowerCase();
  if (rol !== "coordinador" && rol !== "admin") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as {
      coordinador?: string;
      zona?: string;
      periodo?: string;
      totalAprobado?: string;
      facturasIds?: string;
      firmaCoordinador?: string;
      pdfBase64?: string;
      datosPdfJson?: string;
    };

    const coordinador = String(body.coordinador || session.user?.responsable || session.user?.name || "");
    const id = `LEG_${Date.now()}`;
    const fecha = new Date().toISOString();
    let pdfUrl = "";
    const rawPdf = String(body.pdfBase64 || "");
    const folderId = getDriveFacturasRootFolderId();

    if (rawPdf && folderId) {
      try {
        const drive = getDriveClient();
        const base64 = rawPdf.includes(",") ? rawPdf.split(",")[1] : rawPdf;
        const buffer = Buffer.from(base64, "base64");
        const driveResponse = await drive.files.create({
          requestBody: {
            name: `legalizacion_${id}.pdf`,
            parents: [folderId],
          },
          media: {
            mimeType: "application/pdf",
            body: Readable.from(buffer),
          },
          fields: "id, webViewLink",
        });
        await drive.permissions.create({
          fileId: driveResponse.data.id!,
          requestBody: { role: "reader", type: "anyone" },
        });
        pdfUrl = `https://drive.google.com/file/d/${driveResponse.data.id}/view`;
      } catch {
        /* sin PDF en Drive */
      }
    }

    const pdfCell = rawPdf.length > 45000 ? "" : rawPdf;

    const datosJson = String(body.datosPdfJson || "").slice(0, 49000);

    const row: Record<string, string> = {
      ID: id,
      Fecha: fecha,
      Coordinador: coordinador,
      Zona: String(body.zona || ""),
      Periodo: String(body.periodo || ""),
      TotalAprobado: String(body.totalAprobado || "0"),
      FacturasIds: String(body.facturasIds || ""),
      FirmaCoordinador: String(body.firmaCoordinador || "").slice(0, 45000),
      PdfBase64: pdfCell,
      PdfURL: pdfUrl,
      DatosPdfJSON: datosJson,
      Estado: "Pendiente revisión",
    };

    const rows = await getLegalRowsWithHeaders();
    const headers = rows[0];
    if (!headers?.length) return NextResponse.json({ error: "Sin encabezados" }, { status: 500 });
    const rowOut: Record<string, string> = {};
    for (const h of headers) {
      const key = String(h || "").trim();
      if (key && key in row) rowOut[key] = row[key];
    }
    await appendSheetRow("MICAJA", SHEET_NAMES.LEGALIZACIONES, buildAppendRow(headers, rowOut));
    return NextResponse.json({ ok: true, id, pdfURL: pdfUrl });
  } catch {
    return NextResponse.json({ ok: false, error: "No se pudo guardar la legalizacion" }, { status: 500 });
  }
}
