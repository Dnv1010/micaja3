import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { SHEET_NAMES } from "@/lib/google-sheets";
import { appendSheetRow, getSheetData, rowsToObjects } from "@/lib/sheets-helpers";
import { buildAppendRow } from "@/lib/sheet-row";
import { parseSheetDate } from "@/lib/format";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";
import { responsablesEnZonaSet } from "@/lib/users-fallback";
import type { EnvioRow } from "@/types/models";

const ENVIO_HEADERS = ["ID", "Fecha", "Responsable", "Sector", "Monto", "EnviadoPor", "Observaciones"];

const ENTREGAS_HEADERS = ["ID", "Fecha", "Responsable", "Sector", "Monto", "EnviadoPor", "Observaciones"];

async function getEnvioRowsWithHeaders(): Promise<string[][]> {
  const rows = await getSheetData("MICAJA", SHEET_NAMES.ENVIO);
  if (!rows.length || !rows[0]?.some((c) => String(c || "").trim())) {
    await appendSheetRow("MICAJA", SHEET_NAMES.ENVIO, ENVIO_HEADERS);
    return getSheetData("MICAJA", SHEET_NAMES.ENVIO);
  }
  return rows;
}

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
  const rol = String(session.user.rol || "user").toLowerCase();
  if (rol === "user") return NextResponse.json({ data: [] });

  try {
    const { searchParams } = new URL(req.url);
    const sectorQ = searchParams.get("sector")?.trim() || "";
    const responsableQ = searchParams.get("responsable")?.trim().toLowerCase() || "";
    const desde = parseSheetDate(searchParams.get("desde") || "");
    const hasta = parseSheetDate(searchParams.get("hasta") || "");

    let zonaSet: Set<string> | null = null;
    if (sectorQ) {
      if (rol === "admin") zonaSet = responsablesEnZonaSet(sectorQ);
      else if (rol === "coordinador" && String(session.user.sector || "") === sectorQ)
        zonaSet = responsablesEnZonaSet(sectorQ);
      else return NextResponse.json({ data: [] });
    }

    const rows = await getEnvioRowsWithHeaders();
    const data = rowsToObjects<EnvioRow>(rows).filter((row) => {
      const resp = getCellCaseInsensitive(row, "Responsable");
      const fecha = parseSheetDate(getCellCaseInsensitive(row, "Fecha"));
      if (zonaSet && !zonaSet.has(resp.toLowerCase())) return false;
      if (responsableQ && resp.toLowerCase() !== responsableQ) return false;
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
  if (rol !== "admin" && rol !== "coordinador") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as {
      fecha?: string;
      responsable?: string;
      sector?: string;
      monto?: string;
      enviadoPor?: string;
      observaciones?: string;
    };
    const responsable = String(body.responsable || "").trim();
    const sector = String(body.sector || "").trim();
    if (!responsable || !sector) {
      return NextResponse.json({ error: "Responsable y sector son obligatorios" }, { status: 400 });
    }
    if (rol === "coordinador") {
      const set = responsablesEnZonaSet(String(session.user.sector || ""));
      if (!set.has(responsable.toLowerCase()) || sector !== String(session.user.sector || "")) {
        return NextResponse.json({ error: "Usuario fuera de su zona" }, { status: 403 });
      }
    }

    const id = `ENV_${Date.now()}`;
    const fecha = body.fecha || "";
    const monto = String(body.monto || "0");
    const enviadoPor = String(body.enviadoPor || session.user?.name || session.user?.responsable || "");
    const observaciones = String(body.observaciones || "");

    const rowData: Record<string, string> = {
      ID: id,
      Fecha: fecha,
      Responsable: responsable,
      Sector: sector,
      Monto: monto,
      EnviadoPor: enviadoPor,
      Observaciones: observaciones,
    };

    const envRows = await getEnvioRowsWithHeaders();
    const envHeaders = envRows[0];
    if (!envHeaders?.length) return NextResponse.json({ error: "Hoja Envio sin encabezados" }, { status: 500 });
    await appendSheetRow("MICAJA", SHEET_NAMES.ENVIO, buildAppendRow(envHeaders, rowData));

    const entRows = await getEntregasRowsWithHeaders();
    const entHeaders = entRows[0];
    if (entHeaders?.length) {
      await appendSheetRow("MICAJA", SHEET_NAMES.ENTREGAS, buildAppendRow(entHeaders, rowData));
    }

    return NextResponse.json({ ok: true, id });
  } catch {
    return NextResponse.json({ ok: false, error: "No se pudo registrar el envio" }, { status: 500 });
  }
}
