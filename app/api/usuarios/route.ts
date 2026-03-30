import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { SHEET_NAMES } from "@/lib/google-sheets";
import { getSheetData, rowsToObjects } from "@/lib/sheets-helpers";
import { mergeUpdateRowBySpreadsheetId } from "@/lib/sheet-row";
import { loadUsuariosMerged } from "@/lib/usuarios-data";
import { defaultUsuariosSpreadsheetIdForPatch } from "@/lib/usuarios-api";
import { filterUsuariosByVisibility, canManageUsers } from "@/lib/roles";
import { computeSaldoResponsable } from "@/lib/saldo";
import type { EntregaRow, LegalizacionRow } from "@/types/models";
import { revalidateSheet } from "@/lib/revalidate-sheets";
import { sessionCtxFromSession } from "@/lib/session-ctx";
import { spreadsheetKeyForSession } from "@/lib/spreadsheet-key";

export async function GET() {
  const session = await getServerSession(authOptions);
  const ctx = sessionCtxFromSession(session);
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const key = spreadsheetKeyForSession(ctx);

  try {
    const [usuarios, entRows, legRows] = await Promise.all([
      loadUsuariosMerged(),
      getSheetData(key, SHEET_NAMES.ENTREGAS),
      getSheetData(key, SHEET_NAMES.LEGALIZACIONES),
    ]);
    const entregas = rowsToObjects<EntregaRow>(entRows);
    const legalizaciones = rowsToObjects<LegalizacionRow>(legRows);

    const visible = filterUsuariosByVisibility(usuarios, ctx);
    const withSaldo = visible.map((u) => ({
      ...u,
      saldo: computeSaldoResponsable(u.Responsable, entregas, legalizaciones),
    }));

    return NextResponse.json({
      data: withSaldo,
      canManage: canManageUsers(ctx.email),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const ctx = sessionCtxFromSession(session);
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  if (!canManageUsers(ctx.email)) {
    return NextResponse.json({ error: "Solo el administrador principal puede editar" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as {
      rowIndex: number;
      patch: Record<string, string>;
      spreadsheetId?: string;
    };
    if (!body.rowIndex || !body.patch) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }
    const sid = defaultUsuariosSpreadsheetIdForPatch(body.spreadsheetId);
    await mergeUpdateRowBySpreadsheetId(sid, SHEET_NAMES.USUARIOS, body.rowIndex, body.patch);
    revalidateSheet("PETTY_CASH", SHEET_NAMES.USUARIOS);
    revalidateSheet("MICAJA", SHEET_NAMES.USUARIOS);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
