export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getSheetsClient } from "@/lib/google-sheets";

const SHEET_ID =
  process.env.PETTY_CASH_SPREADSHEET_ID || "1sVDPDsDRL9MiiTrzp6YID7k9h9ZaayE50WAEyodZF1k";
const TAB = "Gastos_Generales";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const rol = String(session.user.rol || "").toLowerCase();
  if (rol !== "admin" && rol !== "coordinador") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  try {
    const sheets = await getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${TAB}!A:N`,
    });
    const rows = res.data.values || [];
    if (rows.length < 2) return NextResponse.json({ data: [] });

    const headers = rows[0];
    const data = rows.slice(1).map((row, idx) => {
      const obj: Record<string, string> = { _rowIndex: String(idx + 2) };
      headers.forEach((h: string, i: number) => {
        obj[h.trim()] = row[i] || "";
      });
      return obj;
    });

    if (rol === "coordinador") {
      const sector = String(session.user.sector || "");
      const { getUsuariosFromSheet } = await import("@/lib/usuarios-sheet");
      const usuarios = await getUsuariosFromSheet();
      const responsablesZona = usuarios
        .filter((u) => u.sector === sector)
        .map((u) => u.responsable.toLowerCase().trim());
      const filtered = data.filter((d) =>
        responsablesZona.includes((d.Responsable || "").toLowerCase().trim())
      );
      return NextResponse.json({ data: filtered });
    }

    return NextResponse.json({ data });
  } catch (e) {
    console.error("[gastos GET]", e);
    return NextResponse.json({ error: "Error leyendo gastos" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (String(session.user.rol || "").toLowerCase() !== "admin") {
    return NextResponse.json({ error: "Solo admin" }, { status: 403 });
  }

  const { rowIndex, estado } = (await req.json().catch(() => ({}))) as {
    rowIndex?: string;
    estado?: string;
  };
  if (!rowIndex || !estado) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  try {
    const sheets = await getSheetsClient();
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${TAB}!N${rowIndex}`,
      valueInputOption: "RAW",
      requestBody: { values: [[estado]] },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[gastos PATCH]", e);
    return NextResponse.json({ error: "Error actualizando estado" }, { status: 500 });
  }
}
