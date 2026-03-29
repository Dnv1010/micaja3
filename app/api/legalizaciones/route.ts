import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { SHEET_NAMES } from "@/lib/google-sheets";
import {
  appendSheetRow,
  deleteSheetRow,
  getSheetData,
  getSheetId,
  rowsToObjects,
} from "@/lib/sheets-helpers";
import { buildAppendRow, mergeUpdateRow } from "@/lib/sheet-row";
import { uniqueSheetKey } from "@/lib/ids";
import { filterFacturas, filterLegalizaciones, type SessionCtx } from "@/lib/roles";
import type { FacturaRow, LegalizacionRow, UsuarioRow } from "@/types/models";
import { revalidateSheet } from "@/lib/revalidate-sheets";

function sessionCtx(session: Session | null): SessionCtx | null {
  if (!session) return null;
  const email = session.user?.email;
  if (!email) return null;
  return {
    email,
    rol: session.user.rol || "user",
    responsable: session.user.responsable || "",
    area: session.user.area || "",
    sector: session.user.sector || "",
  };
}

async function getFactura(id: string): Promise<FacturaRow | null> {
  const rows = await getSheetData("PETTY_CASH", SHEET_NAMES.FACTURAS);
  const list = rowsToObjects<FacturaRow>(rows);
  return list.find((f) => f.ID_Factura === id) ?? null;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const ctx = session ? sessionCtx(session) : null;
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const [legRows, userRows] = await Promise.all([
      getSheetData("PETTY_CASH", SHEET_NAMES.LEGALIZACIONES),
      getSheetData("PETTY_CASH", SHEET_NAMES.USUARIOS),
    ]);
    const legalizaciones = rowsToObjects<LegalizacionRow>(legRows);
    const usuarios = rowsToObjects<UsuarioRow>(userRows);
    const filtered = filterLegalizaciones(legalizaciones, ctx, usuarios);
    return NextResponse.json({ data: filtered });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const ctx = session ? sessionCtx(session) : null;
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = (await req.json()) as { ID_Factura: string };
    const factura = await getFactura(body.ID_Factura);
    if (!factura) return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });

    if (factura.Legalizado !== "Pendiente") {
      return NextResponse.json({ error: "Factura ya legalizada" }, { status: 400 });
    }

    const usuariosForFact = rowsToObjects<UsuarioRow>(
      await getSheetData("PETTY_CASH", SHEET_NAMES.USUARIOS)
    );
    if (!filterFacturas([factura], ctx, usuariosForFact).length) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const rol = ctx.rol.toLowerCase();
    if (rol === "user" && factura.Responsable !== ctx.responsable) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const legSheet = await getSheetData("PETTY_CASH", SHEET_NAMES.LEGALIZACIONES);
    const headers = legSheet[0];
    if (!headers?.length) {
      return NextResponse.json({ error: "Hoja Legalizaciones sin encabezados" }, { status: 500 });
    }

    const now = new Date().toISOString();
    const idLeg = uniqueSheetKey("LEG");
    const monto = factura.Monto_Factura || "0";

    const data: Record<string, string> = {
      ID_Legalización: idLeg,
      Fecha_Legalización: now,
      ID_Factura: factura.ID_Factura,
      Total_Legalizado: monto,
      Monto_Total: "",
      Total_Caja: "",
      Responsable: factura.Responsable,
    };

    const line = buildAppendRow(headers, data);
    await appendSheetRow("PETTY_CASH", SHEET_NAMES.LEGALIZACIONES, line);
    await mergeUpdateRow("PETTY_CASH", SHEET_NAMES.FACTURAS, factura._rowIndex, {
      Legalizado: "Completado",
    });

    revalidateSheet("PETTY_CASH", SHEET_NAMES.LEGALIZACIONES);
    revalidateSheet("PETTY_CASH", SHEET_NAMES.FACTURAS);

    return NextResponse.json({ ok: true, id: idLeg });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const ctx = session ? sessionCtx(session) : null;
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const idFactura = searchParams.get("idFactura");
  if (!id || !idFactura) {
    return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
  }

  try {
    const legRows = await getSheetData("PETTY_CASH", SHEET_NAMES.LEGALIZACIONES);
    const list = rowsToObjects<LegalizacionRow>(legRows);
    const row = list.find((l) => l.ID_Legalización === id && l.ID_Factura === idFactura);
    if (!row) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    const usuarios = rowsToObjects<UsuarioRow>(
      await getSheetData("PETTY_CASH", SHEET_NAMES.USUARIOS)
    );
    const visible = filterLegalizaciones([row], ctx, usuarios);
    if (!visible.length) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const sheetId = await getSheetId("PETTY_CASH", SHEET_NAMES.LEGALIZACIONES);
    if (sheetId == null) return NextResponse.json({ error: "sheetId" }, { status: 500 });

    await deleteSheetRow("PETTY_CASH", SHEET_NAMES.LEGALIZACIONES, sheetId, row._rowIndex - 1);

    const factura = await getFactura(idFactura);
    if (factura) {
      await mergeUpdateRow("PETTY_CASH", SHEET_NAMES.FACTURAS, factura._rowIndex, {
        Legalizado: "Pendiente",
      });
    }

    revalidateSheet("PETTY_CASH", SHEET_NAMES.LEGALIZACIONES);
    revalidateSheet("PETTY_CASH", SHEET_NAMES.FACTURAS);

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
