import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { TIPOS_FACTURA_FIJOS } from "@/lib/factura-field-options";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const tab = searchParams.get("tab") || "TipoFactura";
  if (tab !== "TipoFactura") return NextResponse.json({ data: [] });

  return NextResponse.json({ data: [...TIPOS_FACTURA_FIJOS] });
}
