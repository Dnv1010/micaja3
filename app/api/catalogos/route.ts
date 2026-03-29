import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { SHEET_NAMES } from "@/lib/google-sheets";
import { getSheetData } from "@/lib/sheets-helpers";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const [tipos, servicios, ciudades] = await Promise.all([
      getSheetData("PETTY_CASH", SHEET_NAMES.TIPO_FACTURA),
      getSheetData("QUICKFUNDS", SHEET_NAMES.SERVICIO_DECLARADO),
      getSheetData("MICAJA", SHEET_NAMES.CIUDAD),
    ]);

    const tipoList = tipos.slice(1).map((r) => r[0]).filter(Boolean);
    const servicioList = servicios.slice(1).map((r) => r[0]).filter(Boolean);
    const ciudadList = ciudades.slice(1).map((r) => r[0]).filter(Boolean);

    return NextResponse.json({
      tiposFactura: tipoList,
      servicios: servicioList,
      ciudades: ciudadList,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
