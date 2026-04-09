export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getSheetsClient } from "@/lib/google-sheets";

const SHEET_ID =
  process.env.PETTY_CASH_SPREADSHEET_ID || "1sVDPDsDRL9MiiTrzp6YID7k9h9ZaayE50WAEyodZF1k";
const TAB = "Gastos_Grupos";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const sheets = await getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `'${TAB}'!A:N`,
    });
    const rows = res.data.values || [];
    const rowIndex = rows.findIndex((r) => String(r[0] || "").trim() === id);
    if (rowIndex === -1) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const actualRow = rowIndex + 1;
    const updates: { range: string; values: string[][] }[] = [];
    if (body.pdfUrl !== undefined) updates.push({ range: `'${TAB}'!L${actualRow}`, values: [[String(body.pdfUrl || "")]] });
    if (body.firma !== undefined) updates.push({ range: `'${TAB}'!M${actualRow}`, values: [[String(body.firma || "")]] });
    if (body.estado !== undefined) updates.push({ range: `'${TAB}'!J${actualRow}`, values: [[String(body.estado || "")]] });
    if (body.total !== undefined) updates.push({ range: `'${TAB}'!I${actualRow}`, values: [[String(body.total || "")]] });
    if (body.gastosIds !== undefined) {
      updates.push({ range: `'${TAB}'!K${actualRow}`, values: [[JSON.stringify(body.gastosIds || [])]] });
    }
    if (body.motivo !== undefined) updates.push({ range: `'${TAB}'!F${actualRow}`, values: [[String(body.motivo || "")]] });

    for (const u of updates) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: u.range,
        valueInputOption: "RAW",
        requestBody: { values: u.values },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[gastos-grupos/:id PATCH] error", { tabExpected: TAB, spreadsheetId: SHEET_ID, error });
    return NextResponse.json({ error: "Error actualizando grupo" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const sheets = await getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `'${TAB}'!A:N`,
    });
    const rows = res.data.values || [];
    const rowIndex = rows.findIndex((r) => String(r[0] || "").trim() === id);
    if (rowIndex === -1) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    await sheets.spreadsheets.values.clear({
      spreadsheetId: SHEET_ID,
      range: `'${TAB}'!A${rowIndex + 1}:N${rowIndex + 1}`,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[gastos-grupos/:id DELETE] error", { tabExpected: TAB, spreadsheetId: SHEET_ID, error });
    return NextResponse.json({ error: "Error eliminando grupo" }, { status: 500 });
  }
}
