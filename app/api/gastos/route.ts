export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getSheetsClient, assertSheetsConfigured } from "@/lib/google-sheets";
import { sheetValuesToRecords } from "@/lib/sheets-helpers";
import { parseSheetDate } from "@/lib/format";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";

const SHEET_ID = "1sVDPDsDRL9MiiTrzp6YID7k9h9ZaayE50WAEyodZF1k";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const rol = String(session.user.rol || "user").toLowerCase();
  if (rol !== "coordinador" && rol !== "admin") return NextResponse.json({ data: [] });

  try {
    assertSheetsConfigured();
    const { searchParams } = new URL(req.url);
    const desde = parseSheetDate(searchParams.get("desde") || "");
    const hasta = parseSheetDate(searchParams.get("hasta") || "");

    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "'Gastos_Generales'!A:N",
    });
    const rows = res.data.values ?? [];
    let data = sheetValuesToRecords(rows);

    data = data.filter((r) => {
      const fecha = parseSheetDate(getCellCaseInsensitive(r, "FechaCreacion"));
      if (desde && (!fecha || fecha < desde)) return false;
      if (hasta && (!fecha || fecha > hasta)) return false;
      return true;
    });

    data.reverse();
    return NextResponse.json({ data });
  } catch (e) {
    console.error("gastos GET:", e);
    return NextResponse.json({ data: [] });
  }
}
