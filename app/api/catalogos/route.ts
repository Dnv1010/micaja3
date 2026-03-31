import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { SHEET_NAMES } from "@/lib/google-sheets";
import { appendSheetRow, getSheetData } from "@/lib/sheets-helpers";

const TIPO_FACTURA_HEADERS = ["TipoFactura"];

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const tab = searchParams.get("tab") || "TipoFactura";
    if (tab !== "TipoFactura") return NextResponse.json({ data: [] });

    let tipos = await getSheetData("MICAJA", SHEET_NAMES.TIPO_FACTURA);
    if (!tipos.length || !tipos[0]?.some((c) => String(c || "").trim())) {
      await appendSheetRow("MICAJA", SHEET_NAMES.TIPO_FACTURA, TIPO_FACTURA_HEADERS);
      tipos = await getSheetData("MICAJA", SHEET_NAMES.TIPO_FACTURA);
    }

    const data = tipos.slice(1).map((r) => String(r[0] || "").trim()).filter(Boolean);
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ data: [] });
  }
}
