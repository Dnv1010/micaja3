import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { SHEET_NAMES } from "@/lib/google-sheets";
import { getSheetData } from "@/lib/sheets-helpers";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const tipos = await getSheetData("MICAJA", SHEET_NAMES.TIPO_FACTURA);
  const tipoList = tipos.slice(1).map((r) => r[0]).filter(Boolean);
  return NextResponse.json({ tiposFactura: tipoList });
}
