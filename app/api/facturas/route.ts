import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { validateFacturaNegocio, type FacturaMutateFields } from "@/lib/factura-mutate-validation";
import { parseCOPString, parseSheetDate } from "@/lib/format";
import {
  appendFacturaRowRaw,
  buildFacturaRowForHeaders,
  loadMicajaFacturasSheetRows,
  type FacturaSheetWriteFields,
} from "@/lib/micaja-facturas-sheet";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";
import { rowsToObjects } from "@/lib/sheets-helpers";
import { responsablesEnZonaSet } from "@/lib/users-fallback";
import type { FacturaRow } from "@/types/models";

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
      const estado = getCellCaseInsensitive(f, "Estado");
      const fecha = getCellCaseInsensitive(f, "Fecha");
      const fechaObj = parseSheetDate(fecha);

      if (zonaSet && !zonaSet.has(responsable.toLowerCase())) return false;
      if (responsableQ && responsable.toLowerCase() !== responsableQ) return false;
      if (estadoQ && estado.toLowerCase() !== estadoQ) return false;
      if (desde && (!fechaObj || fechaObj < desde)) return false;
      if (hasta && (!fechaObj || fechaObj > hasta)) return false;
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      const dateA = new Date(getCellCaseInsensitive(a, "FechaCreacion") || "").getTime();
      const dateB = new Date(getCellCaseInsensitive(b, "FechaCreacion") || "").getTime();
      const ta = Number.isFinite(dateA) ? dateA : 0;
      const tb = Number.isFinite(dateB) ? dateB : 0;
      return tb - ta;
    });

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

    const rows = await loadMicajaFacturasSheetRows();
    const headers = rows[0];
    if (!headers?.length) {
      return NextResponse.json({ error: "Hoja Facturas sin encabezados" }, { status: 500 });
    }

    const id = String(Date.now());
    const fields: FacturaSheetWriteFields = {
      id,
      fecha,
      responsable: body.responsable || String(session.user.responsable || ""),
      area: body.area || String(session.user.area || ""),
      sector,
      ciudad,
      proveedor,
      nit,
      numFactura,
      concepto,
      valor: String(Math.round(valorNum)),
      tipoFactura,
      servicioDeclarado,
      tipoOperacion,
      aNombreBia,
      estado: "Pendiente",
      motivoRechazo: "",
      imagenUrl,
      driveFileId: String(body.driveFileId || "").trim(),
      fechaCreacion: new Date().toISOString(),
    };

    const valores = buildFacturaRowForHeaders(headers, fields);

    console.log("[facturas POST] body recibido:", {
      fecha,
      proveedor,
      nit,
      valor: body.valor,
      tipoFactura,
      numFactura,
    });
    console.log("[facturas POST] fila a escribir:", valores);

    await appendFacturaRowRaw(valores);

    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error("facturas POST:", e);
    return NextResponse.json({ ok: false, error: "No se pudo guardar la factura" }, { status: 500 });
  }
}
