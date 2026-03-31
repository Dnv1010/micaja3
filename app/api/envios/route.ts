import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getSheetsClient, assertSheetsConfigured, SPREADSHEET_IDS, SHEET_NAMES } from "@/lib/google-sheets";
import { quoteSheetTitleForRange, sheetValuesToRecords } from "@/lib/sheets-helpers";
import { parseSheetDate } from "@/lib/format";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";
import { responsablesEnZonaSet } from "@/lib/users-fallback";

function micajaSpreadsheetId(): string {
  const id = SPREADSHEET_IDS.MICAJA.trim();
  if (!id) throw new Error("MICAJA_SPREADSHEET_ID no configurada");
  return id;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const rol = String(session.user.rol || "user").toLowerCase();
  if (rol === "user") return NextResponse.json({ data: [] });

  try {
    assertSheetsConfigured();
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

    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: micajaSpreadsheetId(),
      range: `${quoteSheetTitleForRange(SHEET_NAMES.ENVIO)}!A:F`,
    });
    const rows = res.data.values ?? [];
    let data = sheetValuesToRecords(rows);

    data = data.filter((r) => {
      const resp = getCellCaseInsensitive(r, "Responsable");
      const fecha = parseSheetDate(getCellCaseInsensitive(r, "Fecha"));
      if (zonaSet && !zonaSet.has(resp.toLowerCase())) return false;
      if (responsableQ && resp.toLowerCase() !== responsableQ) return false;
      if (desde && (!fecha || fecha < desde)) return false;
      if (hasta && (!fecha || fecha > hasta)) return false;
      return true;
    });

    data.reverse();
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
      responsable?: string;
      monto?: string | number;
      fecha?: string;
      comprobante?: string;
      telefono?: string;
    };
    const responsable = String(body.responsable || "").trim();
    const fecha = String(body.fecha || "").trim();
    const comprobante = String(body.comprobante ?? "").trim();
    const telefono = String(body.telefono ?? "").trim();

    const montoNum =
      typeof body.monto === "number" && Number.isFinite(body.monto)
        ? String(Math.max(0, Math.round(body.monto)))
        : String(body.monto ?? "").replace(/[^\d]/g, "");

    if (!responsable || !fecha || !montoNum || montoNum === "0") {
      return NextResponse.json(
        { error: "Faltan campos obligatorios: responsable, monto, fecha" },
        { status: 400 }
      );
    }

    if (rol === "coordinador") {
      const set = responsablesEnZonaSet(String(session.user.sector || ""));
      if (!set.has(responsable.toLowerCase())) {
        return NextResponse.json({ error: "Usuario fuera de su zona" }, { status: 403 });
      }
    }

    const ts = Date.now();
    const id = `ENV-${ts}`;
    const idEntrega = `ENT-${ts}`;

    const filaEnvio: string[] = [id, fecha, montoNum, responsable, comprobante, telefono];
    const filaEntrega: string[] = [idEntrega, fecha, id, responsable, montoNum, "", "", ""];

    assertSheetsConfigured();
    const sheets = getSheetsClient();
    const spreadsheetId = micajaSpreadsheetId();

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${quoteSheetTitleForRange(SHEET_NAMES.ENVIO)}!A:F`,
      valueInputOption: "RAW",
      requestBody: { values: [filaEnvio] },
    });

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${quoteSheetTitleForRange(SHEET_NAMES.ENTREGAS)}!A:H`,
      valueInputOption: "RAW",
      requestBody: { values: [filaEntrega] },
    });

    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error("envios POST:", e);
    return NextResponse.json({ ok: false, error: "No se pudo registrar el envío" }, { status: 500 });
  }
}
