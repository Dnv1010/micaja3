export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getSheetsClient } from "@/lib/google-sheets";

const SHEET_ID =
  process.env.PETTY_CASH_SPREADSHEET_ID || "1sVDPDsDRL9MiiTrzp6YID7k9h9ZaayE50WAEyodZF1k";
const TAB = "Gastos_Generales";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ rowIndex: string }> }
) {
  const { rowIndex } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const row = parseInt(rowIndex, 10);
  if (!Number.isFinite(row) || row < 2) {
    return NextResponse.json({ error: "rowIndex inválido" }, { status: 400 });
  }

  const sheets = await getSheetsClient();
  const fieldMap: Record<string, string> = {
    Ciudad: `${TAB}!E${row}`,
    Motivo: `${TAB}!F${row}`,
    FechaInicio: `${TAB}!G${row}`,
    FechaFin: `${TAB}!H${row}`,
    Concepto: `${TAB}!I${row}`,
    CentroCostos: `${TAB}!J${row}`,
    NIT: `${TAB}!K${row}`,
    FechaFactura: `${TAB}!L${row}`,
    Valor: `${TAB}!M${row}`,
    Estado: `${TAB}!N${row}`,
  };

  for (const [field, range] of Object.entries(fieldMap)) {
    if (body[field] !== undefined) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range,
        valueInputOption: "RAW",
        requestBody: { values: [[String(body[field] ?? "")]] },
      });
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ rowIndex: string }> }
) {
  const { rowIndex } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const row = parseInt(rowIndex, 10);
  if (!Number.isFinite(row) || row < 2) {
    return NextResponse.json({ error: "rowIndex inválido" }, { status: 400 });
  }

  try {
    const sheets = await getSheetsClient();
    const sheetList = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
    const tabSheetId = sheetList.data.sheets?.find((s) => s.properties?.title === TAB)?.properties?.sheetId;

    if (typeof tabSheetId !== "number") {
      return NextResponse.json({ error: "No se encontró la pestaña" }, { status: 500 });
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: tabSheetId,
                dimension: "ROWS",
                startIndex: row - 1,
                endIndex: row,
              },
            },
          },
        ],
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[gastos DELETE]", e);
    return NextResponse.json({ error: "Error eliminando gasto" }, { status: 500 });
  }
}
