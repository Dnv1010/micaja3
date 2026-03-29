import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { SHEET_NAMES } from "@/lib/google-sheets";
import { getSheetData, rowsToObjects } from "@/lib/sheets-helpers";
import { mergeUpdateRow } from "@/lib/sheet-row";
import { filterUsuariosByVisibility, canManageUsers, type SessionCtx } from "@/lib/roles";
import { computeSaldoResponsable } from "@/lib/saldo";
import type { EntregaRow, LegalizacionRow, UsuarioRow } from "@/types/models";
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

export async function GET() {
  const session = await getServerSession(authOptions);
  const ctx = session ? sessionCtx(session) : null;
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const [userRows, entRows, legRows] = await Promise.all([
      getSheetData("PETTY_CASH", SHEET_NAMES.USUARIOS),
      getSheetData("PETTY_CASH", SHEET_NAMES.ENTREGAS),
      getSheetData("PETTY_CASH", SHEET_NAMES.LEGALIZACIONES),
    ]);
    const usuarios = rowsToObjects<UsuarioRow>(userRows);
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
  const ctx = session ? sessionCtx(session) : null;
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  if (!canManageUsers(ctx.email)) {
    return NextResponse.json({ error: "Solo el administrador principal puede editar" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as { rowIndex: number; patch: Record<string, string> };
    if (!body.rowIndex || !body.patch) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }
    await mergeUpdateRow("PETTY_CASH", SHEET_NAMES.USUARIOS, body.rowIndex, body.patch);
    revalidateSheet("PETTY_CASH", SHEET_NAMES.USUARIOS);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
