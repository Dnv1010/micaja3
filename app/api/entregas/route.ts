import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { SHEET_NAMES } from "@/lib/google-sheets";
import { getSheetData, rowsToObjects } from "@/lib/sheets-helpers";
import { filterEntregasWithUsuarios, type SessionCtx } from "@/lib/roles";
import type { EntregaRow, UsuarioRow } from "@/types/models";

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
    const [entRows, userRows] = await Promise.all([
      getSheetData("PETTY_CASH", SHEET_NAMES.ENTREGAS),
      getSheetData("PETTY_CASH", SHEET_NAMES.USUARIOS),
    ]);
    const entregas = rowsToObjects<EntregaRow>(entRows);
    const usuarios = rowsToObjects<UsuarioRow>(userRows);
    const filtered = filterEntregasWithUsuarios(entregas, ctx, usuarios);
    return NextResponse.json({ data: filtered });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
