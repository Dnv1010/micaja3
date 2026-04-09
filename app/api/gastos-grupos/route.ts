export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getSheetsClient } from "@/lib/google-sheets";

const SHEET_ID =
  process.env.PETTY_CASH_SPREADSHEET_ID || "1sVDPDsDRL9MiiTrzp6YID7k9h9ZaayE50WAEyodZF1k";
const TAB = "Gastos_Grupos";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const rol = String(session.user.rol || "").toLowerCase();
  if (rol !== "admin" && rol !== "coordinador") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${TAB}!A:N` });
  const rows = res.data.values || [];
  if (rows.length < 2) return NextResponse.json({ data: [] });

  const headers = rows[0];
  let data = rows.slice(1).map((row, idx) => {
    const obj: Record<string, string> = { _rowIndex: String(idx + 2) };
    headers.forEach((h: string, i: number) => {
      obj[h.trim()] = row[i] || "";
    });
    return obj;
  });

  if (rol === "coordinador") {
    const me = String(session.user.responsable || "").trim().toLowerCase();
    data = data.filter((d) => String(d.Responsable || "").trim().toLowerCase() === me);
  }

  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = `GG-${Date.now()}`;
  const now = new Date().toISOString();

  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${TAB}!A:N`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        id,
        now,
        String(body.responsable || session.user.responsable || ""),
        String(body.cargo || session.user.cargo || ""),
        String(body.sector || session.user.sector || ""),
        String(body.motivo || ""),
        String(body.fechaInicio || ""),
        String(body.fechaFin || ""),
        String(body.total || "0"),
        "Borrador",
        JSON.stringify(body.gastosIds || []),
        "",
        "",
        String(body.centroCostos || ""),
      ]],
    },
  });

  return NextResponse.json({ ok: true, id });
}
