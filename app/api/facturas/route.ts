import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { SHEET_NAMES } from "@/lib/google-sheets";
import { appendSheetRow, getSheetData, rowsToObjects } from "@/lib/sheets-helpers";
import { buildAppendRow } from "@/lib/sheet-row";
import { uniqueSheetKey } from "@/lib/ids";
import { todayISO } from "@/lib/format";
import type { FacturaRow } from "@/types/models";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const factRows = await getSheetData("MICAJA", SHEET_NAMES.FACTURAS);
    const facturas = rowsToObjects<FacturaRow>(factRows);
    const rol = String(session.user.rol || "user").toLowerCase();
    const responsable = String(session.user.responsable || "");
    const filtered =
      rol === "user" ? facturas.filter((f) => String(f.Responsable || "") === responsable) : facturas;
    return NextResponse.json({ data: filtered });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al leer facturas";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = (await req.json()) as Record<string, string>;
    const rows = await getSheetData("MICAJA", SHEET_NAMES.FACTURAS);
    const headers = rows[0];
    if (!headers?.length) {
      return NextResponse.json({ error: "Hoja Facturas sin encabezados" }, { status: 500 });
    }

    const data: Record<string, string> = {
      ...body,
      ID: body.ID || uniqueSheetKey("FAC"),
      Responsable: body.Responsable || String(session.user.responsable || ""),
      Fecha: body.Fecha || todayISO(),
      Estado: body.Estado || "Pendiente",
    };

    const line = buildAppendRow(headers, data);
    await appendSheetRow("MICAJA", SHEET_NAMES.FACTURAS, line);

    return NextResponse.json({ ok: true, id: data.ID });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
