import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { SHEET_NAMES } from "@/lib/google-sheets";
import {
  deleteSheetRow,
  getSheetData,
  getSheetId,
  rowsToObjects,
} from "@/lib/sheets-helpers";
import { loadUsuariosMerged } from "@/lib/usuarios-data";
import { mergeUpdateRow } from "@/lib/sheet-row";
import { filterFacturas, canEditVerificado, type SessionCtx } from "@/lib/roles";
import { CENTRO_COSTO_INFO } from "@/lib/format";
import type { FacturaRow } from "@/types/models";
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

async function getFacturaById(id: string): Promise<{ row: FacturaRow; headers: string[] } | null> {
  const rows = await getSheetData("PETTY_CASH", SHEET_NAMES.FACTURAS);
  const headers = rows[0];
  const list = rowsToObjects<FacturaRow>(rows);
  const row = list.find((f) => f.ID_Factura === id);
  if (!row || !headers) return null;
  return { row, headers };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const ctx = session ? sessionCtx(session) : null;
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const found = await getFacturaById(id);
  if (!found) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  const usuarios = await loadUsuariosMerged();
  const allowed = filterFacturas([found.row], ctx, usuarios);
  if (!allowed.length) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  return NextResponse.json({ data: found.row });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const ctx = session ? sessionCtx(session) : null;
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const found = await getFacturaById(id);
  if (!found) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  const usuarios = await loadUsuariosMerged();
  const allowed = filterFacturas([found.row], ctx, usuarios);
  if (!allowed.length) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const patch = (await req.json()) as Record<string, string>;
  if (!canEditVerificado(ctx.rol) && "Verificado" in patch) {
    delete patch.Verificado;
  }

  const centro = patch["Centro de Costo"] ?? found.row["Centro de Costo"];
  if (centro) {
    patch.InfoCentroCosto = CENTRO_COSTO_INFO[centro] || found.row.InfoCentroCosto || "";
  }

  await mergeUpdateRow("PETTY_CASH", SHEET_NAMES.FACTURAS, found.row._rowIndex, patch);
  revalidateSheet("PETTY_CASH", SHEET_NAMES.FACTURAS);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const ctx = session ? sessionCtx(session) : null;
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const found = await getFacturaById(id);
  if (!found) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  const usuarios = await loadUsuariosMerged();
  const allowed = filterFacturas([found.row], ctx, usuarios);
  if (!allowed.length) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const rol = ctx.rol.toLowerCase();
  if (rol !== "admin" && rol !== "coordinador") {
    return NextResponse.json({ error: "Sin permiso para eliminar" }, { status: 403 });
  }

  const sheetId = await getSheetId("PETTY_CASH", SHEET_NAMES.FACTURAS);
  if (sheetId == null) {
    return NextResponse.json({ error: "No se pudo obtener sheetId" }, { status: 500 });
  }

  await deleteSheetRow(
    "PETTY_CASH",
    SHEET_NAMES.FACTURAS,
    sheetId,
    found.row._rowIndex - 1
  );
  revalidateSheet("PETTY_CASH", SHEET_NAMES.FACTURAS);
  return NextResponse.json({ ok: true });
}
