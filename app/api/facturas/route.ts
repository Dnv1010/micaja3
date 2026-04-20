export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { crearFacturaMicaja, type FacturaCreateBody } from "@/lib/facturas-create-micaja";
import { verifyInternalApiKey } from "@/lib/internal-api";
import { parseSheetDate } from "@/lib/format";
import { loadFacturas } from "@/lib/facturas-supabase";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";
import { sectorsEquivalent } from "@/lib/sector-normalize";
import { responsablesEnZonaSheetSet } from "@/lib/usuarios-sheet";
import type { FacturaRow } from "@/types/models";

function facturaEstadoCell(f: FacturaRow): string {
  return getCellCaseInsensitive(f, "Estado", "Legalizado", "Verificado") || "Pendiente";
}

function facturaFechaCell(f: FacturaRow): string {
  return getCellCaseInsensitive(f, "Fecha_Factura", "Fecha");
}

function sortKeyFactura(f: FacturaRow): number {
  const fc = getCellCaseInsensitive(f, "FechaCreacion");
  const t = fc ? new Date(fc).getTime() : NaN;
  if (Number.isFinite(t)) return t;
  const fd = parseSheetDate(facturaFechaCell(f));
  if (fd) return fd.getTime();
  const idn = Number(getCellCaseInsensitive(f, "ID_Factura", "ID"));
  return Number.isFinite(idn) ? idn : 0;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const responsableQ = searchParams.get("responsable")?.trim().toLowerCase() || "";
    const estadoQ = searchParams.get("estado")?.trim().toLowerCase() || "";
    const desdeQ = searchParams.get("desde") || "";
    const hastaQ = searchParams.get("hasta") || "";
    const desde = parseSheetDate(desdeQ);
    const hasta = parseSheetDate(hastaQ);
    const zonaSector = searchParams.get("zonaSector")?.trim() || "";
    const rol = String(session.user.rol || "").toLowerCase();

    let zonaSet: Set<string> | null = null;
    if (zonaSector) {
      if (rol === "admin") {
        zonaSet = await responsablesEnZonaSheetSet(zonaSector);
      } else if (
        rol === "coordinador" &&
        sectorsEquivalent(String(session.user.sector || ""), zonaSector)
      ) {
        zonaSet = await responsablesEnZonaSheetSet(zonaSector);
      } else if (rol === "user") {
        // user solo ve sus propias facturas (filtro por responsableQ abajo)
      } else {
        return NextResponse.json({ data: [] });
      }
    }

    const facturas = await loadFacturas();

    const filtered = facturas.filter((f) => {
      const responsable = getCellCaseInsensitive(f, "Responsable");
      const estado = facturaEstadoCell(f);
      const fecha = facturaFechaCell(f);
      const fechaObj = parseSheetDate(fecha);

      if (zonaSet && !zonaSet.has(responsable.toLowerCase())) return false;
      if (responsableQ && responsable.toLowerCase() !== responsableQ) return false;
      if (estadoQ && estado.toLowerCase() !== estadoQ) return false;
      if (desde && (!fechaObj || fechaObj < desde)) return false;
      if (hasta && (!fechaObj || fechaObj > hasta)) return false;
      return true;
    });

    const sorted = [...filtered].sort((a, b) => sortKeyFactura(b) - sortKeyFactura(a));
    return NextResponse.json({ data: sorted });
  } catch (e) {
    console.error("facturas GET:", e);
    return NextResponse.json({ data: [] });
  }
}

export async function POST(req: NextRequest) {
  const internal = verifyInternalApiKey(req);

  let body: FacturaCreateBody;
  try {
    body = (await req.json()) as FacturaCreateBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (internal) {
    if (!process.env.INTERNAL_API_KEY?.trim()) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const result = await crearFacturaMicaja(body, { kind: "internal" });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, duplicada: result.duplicada },
        { status: result.status }
      );
    }
    return NextResponse.json({ ok: true, id: result.id, estadoInicial: result.estadoInicial });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const result = await crearFacturaMicaja(body, { kind: "session", session });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, duplicada: result.duplicada },
      { status: result.status }
    );
  }
  return NextResponse.json({ ok: true, id: result.id, estadoInicial: result.estadoInicial });
}
