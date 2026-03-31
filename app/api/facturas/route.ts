import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  CIUDADES_FACTURA,
  SERVICIOS_DECLARADOS,
  SECTORES_FACTURA,
  TIPOS_FACTURA_FIJOS,
  TIPOS_OPERACION,
} from "@/lib/factura-field-options";
import { SHEET_NAMES } from "@/lib/google-sheets";
import { appendSheetRow, getSheetData, rowsToObjects } from "@/lib/sheets-helpers";
import { buildAppendRow } from "@/lib/sheet-row";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";
import { parseCOPString, parseSheetDate } from "@/lib/format";
import {
  isFechaFacturaFutura,
  parseFechaFacturaDDMMYYYY,
} from "@/lib/nueva-factura-validation";
import type { FacturaRow } from "@/types/models";
import { responsablesEnZonaSet } from "@/lib/users-fallback";

const FACTURAS_HEADERS = [
  "ID",
  "Fecha",
  "Responsable",
  "Area",
  "Sector",
  "Ciudad",
  "Proveedor",
  "NIT",
  "Concepto",
  "Valor",
  "TipoFactura",
  "ServicioDeclarado",
  "TipoOperacion",
  "ANombreBia",
  "Estado",
  "MotivoRechazo",
  "ImagenURL",
  "DriveFileId",
  "FechaCreacion",
];

const setTipo = new Set<string>(TIPOS_FACTURA_FIJOS);
const setServ = new Set<string>(SERVICIOS_DECLARADOS);
const setCiudad = new Set<string>(CIUDADES_FACTURA);
const setSector = new Set<string>(SECTORES_FACTURA);
const setOp = new Set<string>(TIPOS_OPERACION);

async function getFacturasRowsWithHeaders(): Promise<string[][]> {
  const rows = await getSheetData("MICAJA", SHEET_NAMES.FACTURAS);
  if (!rows.length || !rows[0]?.some((c) => String(c || "").trim())) {
    await appendSheetRow("MICAJA", SHEET_NAMES.FACTURAS, FACTURAS_HEADERS);
    return getSheetData("MICAJA", SHEET_NAMES.FACTURAS);
  }
  return rows;
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

    const factRows = await getFacturasRowsWithHeaders();
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
    return NextResponse.json({ data: filtered });
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
    const aNombreBia = Boolean(body.aNombreBia);
    const valorNum = parseCOPString(String(body.valor || "0"));

    const fechaObj = parseFechaFacturaDDMMYYYY(fecha);
    if (!fechaObj) {
      return NextResponse.json({ error: "La fecha es obligatoria (DD/MM/YYYY)" }, { status: 400 });
    }
    if (isFechaFacturaFutura(fechaObj)) {
      return NextResponse.json({ error: "La fecha no puede ser futura" }, { status: 400 });
    }

    if (!proveedor) {
      return NextResponse.json({ error: "Proveedor es obligatorio" }, { status: 400 });
    }
    if (!concepto) {
      return NextResponse.json({ error: "Concepto es obligatorio" }, { status: 400 });
    }
    if (!tipoFactura || !setTipo.has(tipoFactura)) {
      return NextResponse.json({ error: "Tipo de factura no válido" }, { status: 400 });
    }
    if (!servicioDeclarado || !setServ.has(servicioDeclarado)) {
      return NextResponse.json({ error: "Servicio declarado no válido" }, { status: 400 });
    }
    if (!tipoOperacion || !setOp.has(tipoOperacion)) {
      return NextResponse.json({ error: "Tipo de operación no válido" }, { status: 400 });
    }
    if (!ciudad || !setCiudad.has(ciudad)) {
      return NextResponse.json({ error: "Ciudad no válida" }, { status: 400 });
    }
    if (!sector || !setSector.has(sector)) {
      return NextResponse.json({ error: "Sector no válido" }, { status: 400 });
    }
    if (!Number.isFinite(valorNum) || valorNum <= 0) {
      return NextResponse.json({ error: "El valor debe ser mayor a 0" }, { status: 400 });
    }
    if (aNombreBia && !nit) {
      return NextResponse.json(
        { error: "Si la factura es a nombre de BIA, el NIT es obligatorio" },
        { status: 400 }
      );
    }

    const rows = await getFacturasRowsWithHeaders();
    const headers = rows[0];
    if (!headers?.length) {
      return NextResponse.json({ error: "Hoja Facturas sin encabezados" }, { status: 500 });
    }

    const id = String(Date.now());
    const data: Record<string, string> = {
      ID: id,
      Fecha: fecha,
      Responsable: body.responsable || String(session.user.responsable || ""),
      Area: body.area || String(session.user.area || ""),
      Sector: sector,
      Ciudad: ciudad,
      Proveedor: proveedor,
      NIT: nit,
      Concepto: concepto,
      Valor: String(Math.round(valorNum)),
      TipoFactura: tipoFactura,
      ServicioDeclarado: servicioDeclarado,
      TipoOperacion: tipoOperacion,
      ANombreBia: aNombreBia ? "Sí" : "No",
      Estado: "Pendiente",
      MotivoRechazo: "",
      ImagenURL: imagenUrl,
      DriveFileId: String(body.driveFileId || "").trim(),
      FechaCreacion: new Date().toISOString(),
    };

    const line = buildAppendRow(headers, data);
    await appendSheetRow("MICAJA", SHEET_NAMES.FACTURAS, line);

    return NextResponse.json({ ok: true, id });
  } catch {
    return NextResponse.json({ ok: false, error: "No se pudo guardar la factura" }, { status: 500 });
  }
}
