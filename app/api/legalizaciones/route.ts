import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { assertSheetsConfigured, getSheetsClient, SHEET_NAMES, SPREADSHEET_IDS } from "@/lib/google-sheets";
import { applyFacturaEstadoById } from "@/lib/factura-estado-server";
import { quoteSheetTitleForRange, rowsToObjects, sheetValuesToRecords } from "@/lib/sheets-helpers";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";
import { responsablesEnZonaSet } from "@/lib/users-fallback";
import { loadMicajaFacturasSheetRows } from "@/lib/micaja-facturas-sheet";
import type { FacturaRow } from "@/types/models";

const RANGE = `${quoteSheetTitleForRange(SHEET_NAMES.LEGALIZACIONES)}!A:M`;

function spreadsheetId(): string {
  const id = SPREADSHEET_IDS.MICAJA.trim();
  if (!id) throw new Error("MICAJA_SPREADSHEET_ID no configurada");
  return id;
}

function facturaIdCell(f: FacturaRow): string {
  return getCellCaseInsensitive(f, "ID_Factura", "ID");
}

function facturaEstadoCell(f: FacturaRow): string {
  return getCellCaseInsensitive(f, "Estado", "Legalizado", "Verificado") || "Pendiente";
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    assertSheetsConfigured();
    const res = await getSheetsClient().spreadsheets.values.get({
      spreadsheetId: spreadsheetId(),
      range: RANGE,
    });
    const rows = res.data.values ?? [];
    let data = sheetValuesToRecords(rows);

    const rol = String(session.user.rol || "").toLowerCase();
    const coordinador = String(session.user.responsable || session.user.name || "").trim();

    if (rol !== "admin") {
      data = data.filter((r) => String(r.Coordinador || "").trim() === coordinador);
    }

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
  if (rol !== "coordinador" && rol !== "admin") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as {
      periodoDe?: string;
      periodoHasta?: string;
      total?: string | number;
      facturasIds?: string[];
      firmaCoordinador?: string;
    };

    const periodoDe = String(body.periodoDe || "").trim();
    const periodoHasta = String(body.periodoHasta || "").trim();
    const facturasIds = Array.isArray(body.facturasIds) ? body.facturasIds.map(String) : [];
    const firmaCoordinador = String(body.firmaCoordinador || "").trim().slice(0, 45000);
    const totalStr = String(
      typeof body.total === "number" && Number.isFinite(body.total) ? Math.round(body.total) : body.total || "0"
    );

    if (!periodoDe || !periodoHasta || !facturasIds.length || !firmaCoordinador) {
      return NextResponse.json(
        { error: "Faltan periodoDe, periodoHasta, facturasIds o firmaCoordinador" },
        { status: 400 }
      );
    }

    const sector = String(session.user.sector || "").trim();
    const coordinadorNombre = String(session.user.responsable || session.user.name || "").trim();
    const zonaSet = rol === "coordinador" ? responsablesEnZonaSet(sector) : null;
    const mine = coordinadorNombre.toLowerCase();

    const factRows = await loadMicajaFacturasSheetRows();
    const facturas = rowsToObjects<FacturaRow>(factRows);
    const byId = new Map(facturas.map((f) => [facturaIdCell(f), f]));

    for (const fid of facturasIds) {
      const f = byId.get(fid);
      if (!f) {
        return NextResponse.json({ error: `Factura no encontrada: ${fid}` }, { status: 400 });
      }
      const est = facturaEstadoCell(f).toLowerCase();
      if (est === "completada") {
        return NextResponse.json({ error: `La factura ${fid} ya está completada` }, { status: 400 });
      }
      if (est !== "aprobada") {
        return NextResponse.json({ error: `La factura ${fid} no está aprobada` }, { status: 400 });
      }
      if (zonaSet) {
        const resp = getCellCaseInsensitive(f, "Responsable").toLowerCase();
        if (!zonaSet.has(resp) && resp !== mine) {
          return NextResponse.json({ error: `Factura fuera de zona: ${fid}` }, { status: 403 });
        }
      }
    }

    const id = `REP-${Date.now()}`;
    const fila = [
      id,
      new Date().toLocaleDateString("es-CO"),
      coordinadorNombre,
      sector,
      periodoDe,
      periodoHasta,
      totalStr,
      "Pendiente Admin",
      JSON.stringify(facturasIds),
      firmaCoordinador,
      "",
      "",
      new Date().toISOString(),
    ];

    assertSheetsConfigured();
    await getSheetsClient().spreadsheets.values.append({
      spreadsheetId: spreadsheetId(),
      range: RANGE,
      valueInputOption: "RAW",
      requestBody: { values: [fila] },
    });

    for (const fid of facturasIds) {
      const r = await applyFacturaEstadoById(fid, "Completada", "");
      if (!r.ok) {
        console.error("legalizaciones POST: no se pudo marcar Completada", fid, r);
      }
    }

    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error("legalizaciones POST:", e);
    return NextResponse.json({ ok: false, error: "No se pudo crear el reporte" }, { status: 500 });
  }
}
