import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { SHEET_NAMES } from "@/lib/google-sheets";
import { appendSheetRow, getSheetData, rowsToObjects } from "@/lib/sheets-helpers";
import { buildAppendRow } from "@/lib/sheet-row";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";
import { parseSheetDate } from "@/lib/format";
import type { FacturaRow } from "@/types/models";
import { responsablesEnZonaSet } from "@/lib/users-fallback";

const FACTURAS_HEADERS = [
  "ID",
  "Fecha",
  "Responsable",
  "Area",
  "Sector",
  "Proveedor",
  "NIT",
  "Concepto",
  "Valor",
  "TipoFactura",
  "Estado",
  "MotivoRechazo",
  "ImagenURL",
  "DriveFileId",
  "FechaCreacion",
];

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

    const rows = await getFacturasRowsWithHeaders();
    const headers = rows[0];
    if (!headers?.length) {
      return NextResponse.json({ error: "Hoja Facturas sin encabezados" }, { status: 500 });
    }

    const id = String(Date.now());
    const data: Record<string, string> = {
      ID: id,
      Fecha: body.fecha || "",
      Responsable: body.responsable || String(session.user.responsable || ""),
      Area: body.area || String(session.user.area || ""),
      Sector: body.sector || String(session.user.sector || ""),
      Proveedor: body.proveedor || "",
      NIT: body.nit || "",
      Concepto: body.concepto || "",
      Valor: body.valor || "0",
      TipoFactura: body.tipoFactura || "",
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
