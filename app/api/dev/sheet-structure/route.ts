import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { sheets, assertSheetsConfigured, SPREADSHEET_IDS } from "@/lib/google-sheets";
import { quoteSheetTitleForRange } from "@/lib/sheets-helpers";

/**
 * Solo desarrollo: lista pestañas del libro y la primera fila (encabezados) de cada una.
 * GET /api/dev/sheet-structure
 */
export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "No disponible fuera de desarrollo" }, { status: 404 });
  }

  try {
    assertSheetsConfigured();
    const id =
      SPREADSHEET_IDS.MICAJA?.trim() ||
      SPREADSHEET_IDS.PETTY_CASH?.trim() ||
      SPREADSHEET_IDS.QUICKFUNDS?.trim();
    if (!id) {
      return NextResponse.json(
        { error: "Define MICAJA_SPREADSHEET_ID o PETTY_CASH_SPREADSHEET_ID en .env" },
        { status: 400 }
      );
    }

    const meta = await sheets!.spreadsheets.get({
      spreadsheetId: id,
      fields: "sheets(properties(title,sheetId))",
    });

    const sheetsList = meta.data.sheets ?? [];
    const result: { title: string; sheetId: number | undefined; columns: string[] }[] = [];

    for (const s of sheetsList) {
      const title = s.properties?.title;
      if (!title) continue;
      const range = `${quoteSheetTitleForRange(title)}!1:1`;
      const v = await sheets!.spreadsheets.values.get({
        spreadsheetId: id,
        range,
      });
      const row = v.data.values?.[0] ?? [];
      result.push({
        title,
        sheetId: s.properties?.sheetId ?? undefined,
        columns: row.map((c) => String(c ?? "").trim()),
      });
    }

    return NextResponse.json({
      spreadsheetId: id,
      environment: "development",
      sheets: result,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al leer la hoja";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
