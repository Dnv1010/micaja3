import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { validateFacturaNegocio, type FacturaMutateFields } from "@/lib/factura-mutate-validation";
import { parseCOPString, parseSheetDate } from "@/lib/format";
import {
  appendFacturaRowLegacyAS,
  buildMicajaFacturasLegacyRowAS,
  loadMicajaFacturasSheetRows,
} from "@/lib/micaja-facturas-sheet";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";
import { rowsToObjects } from "@/lib/sheets-helpers";
import { responsablesEnZonaSet } from "@/lib/users-fallback";
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
    let zonaSet: Set<string> | null = null;
    if (zonaSector) {
      if (rol === "admin") {
        zonaSet = responsablesEnZonaSet(zonaSector);
      } else if (rol === "coordinador" && String(session.user.sector || "") === zonaSector) {
        zonaSet = responsablesEnZonaSet(zonaSector);
      } else {
        return NextResponse.json({ data: [] });
      }
    }

    const factRows = await loadMicajaFacturasSheetRows();
    const facturas = rowsToObjects<FacturaRow>(factRows);
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
  } catch {
    return NextResponse.json({ data: [] });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = (await req.json()) as {
      fecha?: string;
      proveedor?: string;
      nit?: string;
      numFactura?: string;
      concepto?: string;
      valor?: string;
      tipoFactura?: string;
      servicioDeclarado?: string;
      tipoOperacion?: string;
      aNombreBia?: boolean;
      ciudad?: string;
      responsable?: string;
      area?: string;
      sector?: string;
      imagenUrl?: string;
      driveFileId?: string;
    };

    const imagenUrl = String(body.imagenUrl || "").trim();
    if (!imagenUrl) {
      return NextResponse.json(
        { error: "La factura debe incluir la imagen en Drive (imagenUrl)" },
        { status: 400 }
      );
    }

    const fecha = String(body.fecha || "").trim();
    const proveedor = String(body.proveedor || "").trim();
    const concepto = String(body.concepto || "").trim();
    const tipoFactura = String(body.tipoFactura || "").trim();
    const servicioDeclarado = String(body.servicioDeclarado || "").trim();
    const tipoOperacion = String(body.tipoOperacion || "").trim();
    const ciudad = String(body.ciudad || "").trim();
    const sector = String(body.sector || "").trim();
    const nit = String(body.nit || "").trim();
    const numFactura = String(body.numFactura || "").trim();
    const aNombreBia = Boolean(body.aNombreBia);
    const valorNum = parseCOPString(String(body.valor || "0"));

    const mutate: FacturaMutateFields = {
      fecha,
      proveedor,
      concepto,
      tipoFactura,
      servicioDeclarado,
      tipoOperacion,
      ciudad,
      sector,
      nit,
      valorRaw: String(body.valor || "0"),
      aNombreBia,
    };
    const vErr = validateFacturaNegocio(mutate);
    if (vErr) {
      return NextResponse.json({ error: vErr }, { status: 400 });
    }

    await loadMicajaFacturasSheetRows();

    const id = String(Date.now());
    const responsable = body.responsable || String(session.user.responsable || "");
    const sectorFinal = sector || String(session.user.sector || "");

    const fila = buildMicajaFacturasLegacyRowAS({
      id,
      numFactura,
      fecha,
      valor: String(Math.round(valorNum)),
      responsable,
      servicioDeclarado,
      tipoFactura,
      nit,
      razonSocial: proveedor,
      aNombreBia,
      concepto,
      imagenUrl,
      ciudad,
      sector: sectorFinal,
      tipoOperacion,
    });

    console.log("[facturas POST] body recibido:", {
      fecha,
      proveedor,
      nit,
      valor: body.valor,
      tipoFactura,
      numFactura,
      tipoOperacion,
    });
    console.log("[facturas POST] fila A:S:", fila);

    await appendFacturaRowLegacyAS(fila);

    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error("facturas POST:", e);
    return NextResponse.json({ ok: false, error: "No se pudo guardar la factura" }, { status: 500 });
  }
}
