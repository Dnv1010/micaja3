import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  loadMicajaBalancesByResponsable,
  mapToBalanceRows,
  type MicajaBalanceRow,
} from "@/lib/balance-micaja";
import { FALLBACK_USERS } from "@/lib/users-fallback";
import { normalizeSector } from "@/lib/sector-normalize";

/**
 * GET /api/balance — admin: todos; coordinador: solo su zona.
 * ?responsable=Nombre — una fila (admin).
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rol = String(session.user.rol || "user").toLowerCase();

  try {
    if (rol === "coordinador") {
      const sector = String(session.user.sector || "").trim();
      if (!sector) return NextResponse.json({ error: "Sin zona asignada" }, { status: 400 });

      const map = await loadMicajaBalancesByResponsable({ sectorRaw: sector });
      const target = normalizeSector(sector);
      const enZona = FALLBACK_USERS.filter((u) => {
        const uCanon = normalizeSector(u.sector);
        const zoneOk =
          (target !== null && uCanon === target) || (target === null && u.sector === sector.trim());
        return zoneOk;
      });
      const nombres = new Set(enZona.map((u) => u.responsable.trim().toLowerCase()));
      for (const u of enZona) {
        if (!map.has(u.responsable)) map.set(u.responsable, { recibido: 0, gastado: 0 });
      }
      const data = mapToBalanceRows(map).filter((row) =>
        nombres.has(row.responsable.trim().toLowerCase())
      );
      return NextResponse.json({ data });
    }

    if (rol !== "admin") {
      return NextResponse.json({ error: "Solo administradores o coordinadores" }, { status: 403 });
    }

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
