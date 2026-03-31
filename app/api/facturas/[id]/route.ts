import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { SHEET_NAMES } from "@/lib/google-sheets";
import { deleteSheetRow, getSheetData, getSheetId, rowsToObjects } from "@/lib/sheets-helpers";
import { mergeUpdateRow } from "@/lib/sheet-row";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";
import { responsablesEnZonaSet } from "@/lib/users-fallback";
import type { FacturaRow } from "@/types/models";

async function getFacturaById(id: string): Promise<FacturaRow | null> {
  try {
    const rows = await getSheetData("MICAJA", SHEET_NAMES.FACTURAS);
    const list = rowsToObjects<FacturaRow>(rows);
    return list.find((f) => String(f.ID || "") === id) ?? null;
  } catch {
    return null;
  }
}

function puedeCoordinadorEditar(session: { user?: { rol?: string; sector?: string } }, row: FacturaRow): boolean {
  const rol = String(session.user?.rol || "").toLowerCase();
  if (rol === "admin") return true;
  if (rol !== "coordinador") return false;
  const sector = String(session.user?.sector || "");
  const resp = getCellCaseInsensitive(row, "Responsable");
  return responsablesEnZonaSet(sector).has(resp.toLowerCase());
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const found = await getFacturaById(id);
  if (!found) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  return NextResponse.json({ data: found });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const found = await getFacturaById(id);
  if (!found) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  const patch = (await req.json()) as Record<string, string>;
  await mergeUpdateRow("MICAJA", SHEET_NAMES.FACTURAS, found._rowIndex, patch);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const found = await getFacturaById(id);
  if (!found) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  if (!puedeCoordinadorEditar(session, found)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = (await req.json()) as { estado?: string; motivoRechazo?: string };
  const estado = String(body.estado || "").trim();
  if (estado !== "Aprobada" && estado !== "Rechazada") {
    return NextResponse.json({ error: "Estado invalido" }, { status: 400 });
  }
  const motivo = String(body.motivoRechazo || "").trim();

  await mergeUpdateRow("MICAJA", SHEET_NAMES.FACTURAS, found._rowIndex, {
    Estado: estado,
    MotivoRechazo: estado === "Rechazada" ? motivo : "",
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rol = String(session.user.rol || "user").toLowerCase();
  if (rol !== "admin" && rol !== "coordinador") {
    return NextResponse.json({ error: "Sin permiso para eliminar" }, { status: 403 });
  }

  const found = await getFacturaById(id);
  if (!found) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  const sheetId = await getSheetId("MICAJA", SHEET_NAMES.FACTURAS);
  if (sheetId == null) {
    return NextResponse.json({ error: "No se pudo obtener sheetId" }, { status: 500 });
  }
  await deleteSheetRow("MICAJA", SHEET_NAMES.FACTURAS, sheetId, found._rowIndex - 1);
  return NextResponse.json({ ok: true });
}
