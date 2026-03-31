import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { SHEET_NAMES } from "@/lib/google-sheets";
import { appendSheetRow, getSheetData, rowsToObjects } from "@/lib/sheets-helpers";
import { buildAppendRow } from "@/lib/sheet-row";
import { uniqueSheetKey } from "@/lib/ids";
import { todayISO } from "@/lib/format";
import type { EntregaRow } from "@/types/models";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const rows = await getSheetData("MICAJA", SHEET_NAMES.ENTREGAS);
  const data = rowsToObjects<EntregaRow>(rows);
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const rol = String(session.user.rol || "user").toLowerCase();
  if (rol === "user") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const body = (await req.json()) as Record<string, string>;
  const rows = await getSheetData("MICAJA", SHEET_NAMES.ENTREGAS);
  const headers = rows[0];
  if (!headers?.length) return NextResponse.json({ error: "Hoja Entregas sin encabezados" }, { status: 500 });

  const data: Record<string, string> = {
    ...body,
    ID: body.ID || uniqueSheetKey("ENT"),
    Fecha: body.Fecha || todayISO(),
  };
  const line = buildAppendRow(headers, data);
  await appendSheetRow("MICAJA", SHEET_NAMES.ENTREGAS, line);
  return NextResponse.json({ ok: true, id: data.ID });
}
