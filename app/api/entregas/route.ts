import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { SHEET_NAMES } from "@/lib/google-sheets";
import { appendSheetRow, getSheetData, rowsToObjects } from "@/lib/sheets-helpers";
import { buildAppendRow } from "@/lib/sheet-row";
import { uniqueSheetKey } from "@/lib/ids";
import { parseSheetDate, todayISO } from "@/lib/format";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";
import type { EntregaRow } from "@/types/models";
import { responsablesEnZonaSet } from "@/lib/users-fallback";

const ENTREGAS_HEADERS = ["ID", "Fecha", "Responsable", "Sector", "Monto", "EnviadoPor", "Observaciones"];

async function getEntregasRowsWithHeaders(): Promise<string[][]> {
  const rows = await getSheetData("MICAJA", SHEET_NAMES.ENTREGAS);
  if (!rows.length || !rows[0]?.some((c) => String(c || "").trim())) {
    await appendSheetRow("MICAJA", SHEET_NAMES.ENTREGAS, ENTREGAS_HEADERS);
    return getSheetData("MICAJA", SHEET_NAMES.ENTREGAS);
  }
  return rows;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    const { searchParams } = new URL(req.url);
    const responsableQ = searchParams.get("responsable")?.trim().toLowerCase() || "";
    const desde = parseSheetDate(searchParams.get("desde") || "");
    const hasta = parseSheetDate(searchParams.get("hasta") || "");
    const zonaSector = searchParams.get("zonaSector")?.trim() || "";
    const rol = String(session.user.rol || "").toLowerCase();
    let zonaSet: Set<string> | null = null;
    if (zonaSector) {
      if (rol === "admin") zonaSet = responsablesEnZonaSet(zonaSector);
      else if (rol === "coordinador" && String(session.user.sector || "") === zonaSector)
        zonaSet = responsablesEnZonaSet(zonaSector);
      else return NextResponse.json({ data: [] });
    }
    const rows = await getEntregasRowsWithHeaders();
    const data = rowsToObjects<EntregaRow>(rows).filter((row) => {
      const responsable = getCellCaseInsensitive(row, "Responsable");
      const fecha = parseSheetDate(getCellCaseInsensitive(row, "Fecha", "Fecha_Entrega"));
      if (zonaSet && !zonaSet.has(responsable.toLowerCase())) return false;
      if (responsableQ && responsable.toLowerCase() !== responsableQ) return false;
      if (desde && (!fecha || fecha < desde)) return false;
      if (hasta && (!fecha || fecha > hasta)) return false;
      return true;
    });
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ data: [] });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const rol = String(session.user.rol || "user").toLowerCase();
  if (rol === "user") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const body = (await req.json()) as Record<string, string>;
  const rows = await getEntregasRowsWithHeaders();
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
