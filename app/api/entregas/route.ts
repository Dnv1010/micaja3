export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getSheetsClient, assertSheetsConfigured, SPREADSHEET_IDS, SHEET_NAMES } from "@/lib/google-sheets";
import { quoteSheetTitleForRange, sheetValuesToRecords } from "@/lib/sheets-helpers";
import { parseSheetDate, todayISO } from "@/lib/format";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";
import { sectorsEquivalent } from "@/lib/sector-normalize";
import { responsablesEnZonaSheetSet } from "@/lib/usuarios-sheet";
import { uniqueSheetKey } from "@/lib/ids";
import { limiteAprobacionZona } from "@/lib/coordinador-zona";

function micajaSpreadsheetId(): string {
  const id = SPREADSHEET_IDS.MICAJA.trim();
  if (!id) throw new Error("MICAJA_SPREADSHEET_ID no configurada");
  return id;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    assertSheetsConfigured();
    const sheets = getSheetsClient();
    const spreadsheetId = micajaSpreadsheetId();
    const quotedEnt = quoteSheetTitleForRange(SHEET_NAMES.ENTREGAS);
    const quotedEnv = quoteSheetTitleForRange(SHEET_NAMES.ENVIO);

    const [entRes, envRes] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${quotedEnt}!A:H`,
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${quotedEnv}!A:F`,
      }),
    ]);

    const entRows = entRes.data.values ?? [];
    const envRows = envRes.data.values ?? [];
    let data = sheetValuesToRecords(entRows);

    const envioComprobante = new Map<string, string>();
    for (const row of sheetValuesToRecords(envRows)) {
      const idEnv = getCellCaseInsensitive(row, "IDEnvio", "ID");
      if (idEnv) envioComprobante.set(idEnv, getCellCaseInsensitive(row, "Comprobante"));
    }

    for (const row of data) {
      const idEnvio = getCellCaseInsensitive(row, "ID_Envio", "IDEnvio");
      row.ComprobanteEnvio = envioComprobante.get(idEnvio) || "";
    }

    const rol = String(session.user.rol || "").toLowerCase();
    const { searchParams } = new URL(req.url);
    let responsableQ = searchParams.get("responsable")?.trim().toLowerCase() || "";
    if (rol === "user") {
      responsableQ = String(session.user.responsable || "").trim().toLowerCase();
      if (!responsableQ) return NextResponse.json({ data: [] });
    }

    const desde = parseSheetDate(searchParams.get("desde") || "");
    const hasta = parseSheetDate(searchParams.get("hasta") || "");
    const zonaSector = searchParams.get("zonaSector")?.trim() || "";

    let zonaSet: Set<string> | null = null;
    if (zonaSector && rol !== "user") {
      if (rol === "admin") {
        zonaSet = await responsablesEnZonaSheetSet(zonaSector);
      } else if (rol === "coordinador" && sectorsEquivalent(String(session.user.sector || ""), zonaSector)) {
        zonaSet = await responsablesEnZonaSheetSet(zonaSector);
      } else {
        return NextResponse.json({ data: [] });
      }
    }

    data = data.filter((row) => {
      const responsable = getCellCaseInsensitive(row, "Responsable");
      const fecha = parseSheetDate(getCellCaseInsensitive(row, "Fecha_Entrega", "Fecha"));
      if (zonaSet && !zonaSet.has(responsable.toLowerCase())) return false;
      if (responsableQ && responsable.toLowerCase() !== responsableQ) return false;
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
  if (rol === "user") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  try {
    const body = (await req.json()) as Record<string, string>;
    const idEntrega = String(body.ID_Entrega || body.ID || uniqueSheetKey("ENT")).trim();
    const fecha = String(body.Fecha_Entrega || body.Fecha || todayISO()).trim();
    const idEnvio = String(body.ID_Envio || "").trim();
    const responsable = String(body.Responsable || "").trim();
    const monto = String(body.Monto_Entregado || body.Monto || "0").replace(/[^\d]/g, "");
    if (!responsable || !monto) {
      return NextResponse.json({ error: "Responsable y monto son obligatorios" }, { status: 400 });
    }

    if (rol === "coordinador") {
      const limite = limiteAprobacionZona(String(session.user.sector || ""));
      if (Number(monto) > limite) {
        return NextResponse.json(
          { error: `El monto excede el límite de la zona (${limite.toLocaleString("es-CO")})` },
          { status: 400 }
        );
      }
    }

    const fila = [
      idEntrega,
      fecha,
      idEnvio,
      responsable,
      monto,
      String(body.Saldo_Total_Entregado || "").trim(),
      String(body.Aceptar || "").trim(),
      String(body.Firma || "").trim(),
    ];

    assertSheetsConfigured();
    await getSheetsClient().spreadsheets.values.append({
      spreadsheetId: micajaSpreadsheetId(),
      range: `${quoteSheetTitleForRange(SHEET_NAMES.ENTREGAS)}!A:H`,
      valueInputOption: "RAW",
      requestBody: { values: [fila] },
    });

    return NextResponse.json({ ok: true, id: idEntrega });
  } catch (e) {
    console.error("entregas POST:", e);
    return NextResponse.json({ ok: false, error: "No se pudo registrar" }, { status: 500 });
  }
}