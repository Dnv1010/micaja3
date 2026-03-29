import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { SHEET_NAMES } from "@/lib/google-sheets";
import { getSheetData, rowsToObjects } from "@/lib/sheets-helpers";
import {
  filterEntregasWithUsuarios,
  filterFacturas,
  type SessionCtx,
} from "@/lib/roles";
import { computeSaldoResponsable } from "@/lib/saldo";
import type { EntregaRow, FacturaRow, LegalizacionRow, UsuarioRow } from "@/types/models";
import { parseCOPString } from "@/lib/format";

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
    const [entRows, factRows, legRows, userRows] = await Promise.all([
      getSheetData("PETTY_CASH", SHEET_NAMES.ENTREGAS),
      getSheetData("PETTY_CASH", SHEET_NAMES.FACTURAS),
      getSheetData("PETTY_CASH", SHEET_NAMES.LEGALIZACIONES),
      getSheetData("PETTY_CASH", SHEET_NAMES.USUARIOS),
    ]);

    const usuarios = rowsToObjects<UsuarioRow>(userRows);
    const entregas = filterEntregasWithUsuarios(rowsToObjects<EntregaRow>(entRows), ctx, usuarios);
    const facturas = filterFacturas(rowsToObjects<FacturaRow>(factRows), ctx, usuarios);
    const legalizaciones = rowsToObjects<LegalizacionRow>(legRows);

    const saldo = computeSaldoResponsable(ctx.responsable, rowsToObjects<EntregaRow>(entRows), legalizaciones);

    const pendientes = facturas.filter((f) => f.Legalizado === "Pendiente").length;

    const sortedEnt = [...entregas].sort(
      (a, b) => new Date(b.Fecha_Entrega).getTime() - new Date(a.Fecha_Entrega).getTime()
    );
    const ultimas = sortedEnt.slice(0, 3).map((e) => ({
      ...e,
      montoNum: parseCOPString(e.Monto_Entregado || "0"),
    }));

    return NextResponse.json({
      saldo,
      facturasPendientes: pendientes,
      ultimasEntregas: ultimas,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
