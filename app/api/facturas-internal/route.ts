import { NextRequest, NextResponse } from "next/server";
import { verifyInternalApiKey } from "@/lib/internal-api";
import { crearFacturaMicaja, type FacturaCreateBody } from "@/lib/facturas-create-micaja";

export async function POST(req: NextRequest) {
  if (!verifyInternalApiKey(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: FacturaCreateBody;
  try {
    body = (await req.json()) as FacturaCreateBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
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
