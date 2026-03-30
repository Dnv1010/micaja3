import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { SHEET_NAMES } from "@/lib/google-sheets";
import {
  appendSheetRow,
  deleteSheetRow,
  getSheetData,
  getSheetId,
  rowsToObjects,
} from "@/lib/sheets-helpers";
import { loadUsuariosMerged } from "@/lib/usuarios-data";
import { buildAppendRow, mergeUpdateRow } from "@/lib/sheet-row";
import { uniqueSheetKey } from "@/lib/ids";
import { filterFacturas, filterLegalizaciones } from "@/lib/roles";
import type { FacturaRow, LegalizacionRow } from "@/types/models";
import { revalidateSheet } from "@/lib/revalidate-sheets";
import { sessionCtxFromSession } from "@/lib/session-ctx";
import { spreadsheetKeyForSession } from "@/lib/spreadsheet-key";
import type { SessionCtx } from "@/lib/roles";
import {
  facturaEstado,
  facturaResponsable,
  facturaRowId,
  facturaValor,
  legalizacionIdFactura,
  legalizacionRowId,
} from "@/lib/row-fields";

async function getFactura(ctx: SessionCtx, id: string): Promise<FacturaRow | null> {
  const key = spreadsheetKeyForSession(ctx);
  const rows = await getSheetData(key, SHEET_NAMES.FACTURAS);
  const list = rowsToObjects<FacturaRow>(rows);
  return list.find((f) => facturaRowId(f) === id) ?? null;
}

function facturaPendienteLegalizar(f: FacturaRow): boolean {
  const leg = (facturaEstado(f) || f.Legalizado || "").trim().toLowerCase();
  if (leg.includes("completado")) return false;
  return leg.includes("pendiente") || leg === "";
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const ctx = sessionCtxFromSession(session);
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const key = spreadsheetKeyForSession(ctx);

  try {
    const [legRows, usuarios] = await Promise.all([
      getSheetData(key, SHEET_NAMES.LEGALIZACIONES),
      loadUsuariosMerged(),
    ]);
    const legalizaciones = rowsToObjects<LegalizacionRow>(legRows);
    const filtered = filterLegalizaciones(legalizaciones, ctx, usuarios);
    return NextResponse.json({ data: filtered });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al leer legalizaciones";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const ctx = sessionCtxFromSession(session);
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const key = spreadsheetKeyForSession(ctx);

  try {
    const body = (await req.json()) as { ID_Factura: string };
    const factura = await getFactura(ctx, body.ID_Factura);
    if (!factura) return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });

    if (!facturaPendienteLegalizar(factura)) {
      return NextResponse.json({ error: "Factura ya legalizada" }, { status: 400 });
    }

    const usuariosForFact = await loadUsuariosMerged();
    if (!filterFacturas([factura], ctx, usuariosForFact).length) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const rol = ctx.rol.toLowerCase();
    if (rol === "user" && facturaResponsable(factura) !== ctx.responsable) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const legSheet = await getSheetData(key, SHEET_NAMES.LEGALIZACIONES);
    const headers = legSheet[0];
    if (!headers?.length) {
      return NextResponse.json({ error: "Hoja Legalizaciones sin encabezados" }, { status: 500 });
    }

    const now = new Date().toISOString();
    const idLeg = uniqueSheetKey("LEG");
    const monto = facturaValor(factura) || factura.Monto_Factura || "0";
    const idFacturaCell = facturaRowId(factura);

    const data: Record<string, string> = {
      ID_Legalización: idLeg,
      Fecha_Legalización: now,
      ID_Factura: idFacturaCell,
      Total_Legalizado: monto,
      Monto_Total: "",
      Total_Caja: "",
      Responsable: facturaResponsable(factura),
    };

    const line = buildAppendRow(headers, data);
    await appendSheetRow(key, SHEET_NAMES.LEGALIZACIONES, line);
    await mergeUpdateRow(key, SHEET_NAMES.FACTURAS, factura._rowIndex, {
      Legalizado: "Completado",
    });

    revalidateSheet(key, SHEET_NAMES.LEGALIZACIONES);
    revalidateSheet(key, SHEET_NAMES.FACTURAS);

    return NextResponse.json({ ok: true, id: idLeg });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al crear legalización";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const ctx = sessionCtxFromSession(session);
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const key = spreadsheetKeyForSession(ctx);

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const idFactura = searchParams.get("idFactura");
  if (!id || !idFactura) {
    return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
  }

  try {
    const legRows = await getSheetData(key, SHEET_NAMES.LEGALIZACIONES);
    const list = rowsToObjects<LegalizacionRow>(legRows);
    const row = list.find(
      (l) => legalizacionRowId(l) === id && legalizacionIdFactura(l) === idFactura
    );
    if (!row) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    const usuarios = await loadUsuariosMerged();
    const visible = filterLegalizaciones([row], ctx, usuarios);
    if (!visible.length) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const sheetId = await getSheetId(key, SHEET_NAMES.LEGALIZACIONES);
    if (sheetId == null) return NextResponse.json({ error: "sheetId" }, { status: 500 });

    await deleteSheetRow(key, SHEET_NAMES.LEGALIZACIONES, sheetId, row._rowIndex - 1);

    const factura = await getFactura(ctx, idFactura);
    if (factura) {
      await mergeUpdateRow(key, SHEET_NAMES.FACTURAS, factura._rowIndex, {
        Legalizado: "Pendiente",
      });
    }

    revalidateSheet(key, SHEET_NAMES.LEGALIZACIONES);
    revalidateSheet(key, SHEET_NAMES.FACTURAS);

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al eliminar";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
