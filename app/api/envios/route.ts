import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getSheetsClient, assertSheetsConfigured, SPREADSHEET_IDS, SHEET_NAMES } from "@/lib/google-sheets";
import { quoteSheetTitleForRange, sheetValuesToRecords } from "@/lib/sheets-helpers";
import { parseSheetDate } from "@/lib/format";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";
import { sectorsEquivalent } from "@/lib/sector-normalize";
import { formatCOP } from "@/lib/format";
import { appPublicBaseUrl, escHtml, notificarUsuario } from "@/lib/notificaciones";
import { responsablesEnZonaSheetSet } from "@/lib/usuarios-sheet";
import { limiteAprobacionZona } from "@/lib/coordinador-zona";

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
      if (rol === "admin") zonaSet = await responsablesEnZonaSheetSet(sectorQ);
      else if (rol === "coordinador" && sectorsEquivalent(String(session.user.sector || ""), sectorQ))
        zonaSet = await responsablesEnZonaSheetSet(sectorQ);
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
      const set = await responsablesEnZonaSheetSet(String(session.user.sector || ""));
      const yo = String(session.user.responsable || session.user.name || "").trim().toLowerCase();
      if (yo) set.add(yo);
      if (!set.has(responsable.toLowerCase())) {
        return NextResponse.json({ error: "Usuario fuera de su zona" }, { status: 403 });
      }
      const limite = limiteAprobacionZona(String(session.user.sector || ""));
      if (Number(montoNum) > limite) {
        return NextResponse.json(
          { error: `El monto excede el límite de la zona (${limite.toLocaleString("es-CO")})` },
          { status: 400 }
        );
      }
    }

    const ts = Date.now();
    const id = `ENV-${ts}`;
    const idEntrega = `ENT-${ts}`;

    // Comprobante (URL Drive) va en hoja Envío (columna según encabezados). La API GET /api/entregas
    // cruza por ID_Envio y expone el mismo URL en ComprobanteEnvio para el usuario.
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

    const coord = String(session.user.responsable || session.user.name || "").trim();
    const montoCOP = Number(montoNum) || 0;
    const base = appPublicBaseUrl();
    const msg = [
      `💸 <b>BIA Energy - MiCaja</b>`,
      ``,
      `Hola ${escHtml(responsable)}, tu coordinador <b>${escHtml(coord)}</b> te envió <b>${escHtml(formatCOP(montoCOP))}</b> el ${escHtml(fecha)}.`,
      ``,
      `Revisa tu saldo: ${escHtml(base)}`,
    ].join("\n");
    void notificarUsuario(responsable, msg).catch(() => {});

    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error("envios POST:", e);
    return NextResponse.json({ ok: false, error: "No se pudo registrar el envío" }, { status: 500 });
  }
}


export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const rol = String(session.user.rol || "user").toLowerCase();
  if (rol !== "admin" && rol !== "coordinador") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as { id?: string };
    const id = String(body.id || "").trim();
    if (!id) return NextResponse.json({ error: "Falta ID" }, { status: 400 });

    assertSheetsConfigured();
    const sheets = getSheetsClient();
    const spreadsheetId = micajaSpreadsheetId();

    // Buscar y eliminar en Envio
    const envioRange = `${quoteSheetTitleForRange(SHEET_NAMES.ENVIO)}!A:F`;
    const envioRes = await sheets.spreadsheets.values.get({ spreadsheetId, range: envioRange });
    const envioRows = envioRes.data.values ?? [];
    let envioRowIdx = -1;
    for (let i = 1; i < envioRows.length; i++) {
      if (String(envioRows[i][0] || "").trim() === id) { envioRowIdx = i; break; }
    }

    if (envioRowIdx === -1) {
      return NextResponse.json({ error: "Envio no encontrado" }, { status: 404 });
    }

    if (rol === "coordinador") {
      const respEnvio = String(envioRows[envioRowIdx][3] || "").trim().toLowerCase();
      const set = await responsablesEnZonaSheetSet(String(session.user.sector || ""));
      const yo = String(session.user.responsable || session.user.name || "").trim().toLowerCase();
      if (yo) set.add(yo);
      if (!respEnvio || !set.has(respEnvio)) {
        return NextResponse.json({ error: "Envio fuera de su zona" }, { status: 403 });
      }
    }

    // Obtener sheetId del tab Envio
    const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" });
    const envioSheet = meta.data.sheets?.find(
      (s) => s.properties?.title === SHEET_NAMES.ENVIO
    );
    const entregaSheet = meta.data.sheets?.find(
      (s) => s.properties?.title === SHEET_NAMES.ENTREGAS
    );

    // Eliminar fila de Envio
    if (envioSheet?.properties?.sheetId != null) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{
            deleteDimension: {
              range: {
                sheetId: envioSheet.properties.sheetId,
                dimension: "ROWS",
                startIndex: envioRowIdx,
                endIndex: envioRowIdx + 1,
              },
            },
          }],
        },
      });
    }

    // Buscar y eliminar en Entregas por ID_Envio
    if (entregaSheet?.properties?.sheetId != null) {
      const entregaRange = `${quoteSheetTitleForRange(SHEET_NAMES.ENTREGAS)}!A:H`;
      const entregaRes = await sheets.spreadsheets.values.get({ spreadsheetId, range: entregaRange });
      const entregaRows = entregaRes.data.values ?? [];
      // ID_Envio esta en columna C (indice 2)
      for (let i = entregaRows.length - 1; i >= 1; i--) {
        if (String(entregaRows[i][2] || "").trim() === id) {
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
              requests: [{
                deleteDimension: {
                  range: {
                    sheetId: entregaSheet.properties.sheetId,
                    dimension: "ROWS",
                    startIndex: i,
                    endIndex: i + 1,
                  },
                },
              }],
            },
          });
          break;
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("envios DELETE:", e);
    return NextResponse.json({ ok: false, error: "No se pudo eliminar" }, { status: 500 });
  }
}
