export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { crearFacturaMicaja, type FacturaCreateBody } from "@/lib/facturas-create-micaja";
import { verifyInternalApiKey } from "@/lib/internal-api";
import { parseSheetDate } from "@/lib/format";
import { loadMicajaFacturasSheetRows } from "@/lib/micaja-facturas-sheet";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";
import { rowsToObjects } from "@/lib/sheets-helpers";
import { normalizeSector, sectorsEquivalent } from "@/lib/sector-normalize";
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
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

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

    // Validar acceso por zona
    if (zonaSector) {
      if (rol === "admin") {
        // admin puede ver cualquier zona
      } else if (rol === "coordinador" && sectorsEquivalent(String(session.user.sector || ""), zonaSector)) {
        // coordinador solo puede ver su propia zona
      } else if (rol === "user") {
        // user solo ve sus propias facturas — se filtra por responsableQ abajo
      } else {
        return NextResponse.json({ data: [] });
      }
    }

    const factRows = await loadMicajaFacturasSheetRows();
    const facturas = rowsToObjects<FacturaRow>(factRows);
    const filterSec = normalizeSector(zonaSector);

    const filtered = facturas.filter((f) => {
      const responsable = getCellCaseInsensitive(f, "Responsable");
      const estado = facturaEstadoCell(f);
      const fecha = facturaFechaCell(f);
      const fechaObj = parseSheetDate(fecha);

      // ── Filtro por zona: usar SOLO la columna Sector de la factura ──
      if (filterSec !== null) {
        const rowSec = normalizeSector(getCellCaseInsensitive(f, "Sector") || "");
        // Si la factura no tiene sector reconocible, excluirla al filtrar por zona
        if (rowSec !== filterSec) return false;
      }

      if (responsableQ && responsable.toLowerCase() !== responsableQ) return false;
      if (estadoQ && estado.toLowerCase() !== estadoQ) return false;
      if (desde && (!fechaObj || fechaObj < desde)) return false;
      if (hasta && (!fechaObj || fechaObj > hasta)) return false;
      return true;
    });

    const sorted = [...filtered].sort((a, b) => sortKeyFactura(b) - sortKeyFactura(a));

    return NextResponse.json({ data: sorted });
  } catch {
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
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const result = await crearFacturaMicaja(body, { kind: "session", session });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, duplicada: result.duplicada },
      { status: result.status }
    );
  }
  return NextResponse.json({ ok: true, id: result.id, estadoInicial: result.estadoInicial });
}