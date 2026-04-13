export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getSheetsClient } from "@/lib/google-sheets";

const SHEET_ID = process.env.PETTY_CASH_SPREADSHEET_ID || "";
const TAB = "Gastos_Grupos";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    const rol = String(session.user.rol || "").toLowerCase();
    if (rol !== "admin" && rol !== "coordinador") {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `'${TAB}'!A:N`,
    });
    const rows = res.data.values || [];
    if (rows.length < 2) return NextResponse.json({ data: [] });

    const headers = rows[0];
    let data = rows.slice(1).map((row, idx) => {
      const obj: Record<string, string> = { _rowIndex: String(idx + 2) };
      headers.forEach((h: string, i: number) => { obj[h.trim()] = row[i] || ""; });
      return obj;
    });

    if (rol === "coordinador") {
      const me = String(session.user.responsable || "").trim().toLowerCase();
      data = data.filter((d) => String(d.Responsable || "").trim().toLowerCase() === me);
    }

    return NextResponse.json({ data });
  } catch (error) {
    const msg = error instanceof Error ? error.message : JSON.stringify(error);
    return NextResponse.json({ error: "Error obteniendo grupos", detalle: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await req.json() as {
      responsable?: string;
      cargo?: string;
      sector?: string;
      motivo?: string;
      fechaInicio?: string;
      fechaFin?: string;
      centroCostos?: string;
      gastosIds?: string[];
      total?: string;
    };

    const sheets = getSheetsClient();
    const id = `GG-${Date.now()}`;
    const fecha = new Date().toLocaleDateString("es-CO");

    const row = [
      id,
      fecha,
      body.responsable || "",
      body.cargo || "",
      body.sector || "",
      body.motivo || "",
      body.fechaInicio || "",
      body.fechaFin || "",
      body.centroCostos || "",
      (body.gastosIds || []).join(","),
      body.total || "0",
      "Pendiente",
      "",
      "",
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `'${TAB}'!A:N`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [row] },
    });

    return NextResponse.json({ id, ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : JSON.stringify(error);
    console.error("[gastos-grupos POST]", msg);
    return NextResponse.json({ error: "Error creando grupo", detalle: msg }, { status: 500 });
  }
}