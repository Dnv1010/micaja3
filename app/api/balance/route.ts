import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  loadMicajaBalancesByResponsable,
  mapToBalanceRows,
  type MicajaBalanceRow,
} from "@/lib/balance-micaja";
import { FALLBACK_USERS } from "@/lib/users-fallback";

/**
 * GET /api/balance — solo admin.
 * ?responsable=Nombre — una fila (si hay datos en Sheets para ese nombre).
 * sin query — todas las filas con movimientos en Entregas/Facturas.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rol = String(session.user.rol || "user").toLowerCase();
  if (rol !== "admin") {
    return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const responsableQ = searchParams.get("responsable")?.trim() || "";

    const map = await loadMicajaBalancesByResponsable();
    if (!responsableQ) {
      for (const u of FALLBACK_USERS) {
        if (!map.has(u.responsable)) map.set(u.responsable, { recibido: 0, gastado: 0 });
      }
    }
    const data = mapToBalanceRows(map, responsableQ || undefined);

    if (responsableQ && data.length === 0) {
      const empty: MicajaBalanceRow = {
        responsable: responsableQ,
        totalRecibido: 0,
        totalGastado: 0,
        balance: 0,
      };
      return NextResponse.json({ data: [empty] });
    }

    return NextResponse.json({ data });
  } catch (e) {
    console.error("balance GET:", e);
    return NextResponse.json({ error: "No se pudo calcular el balance" }, { status: 500 });
  }
}
