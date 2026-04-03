import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  generarResumenLegalizacionGemini,
  type FacturaResumenLinea,
} from "@/lib/gemini-resumen-legalizacion";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const rol = String(session.user.rol || "").toLowerCase();
  if (rol !== "coordinador" && rol !== "admin") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as {
      facturas?: FacturaResumenLinea[];
      coordinador?: string;
      sector?: string;
      total?: number;
      limite?: number;
    };

    const facturas = Array.isArray(body.facturas) ? body.facturas : [];
    if (!facturas.length) {
      return NextResponse.json({ resumen: "No hay facturas para analizar." });
    }

    const coordinador = String(body.coordinador || session.user.responsable || session.user.name || "");
    const sector = String(body.sector || session.user.sector || "");
    const total = typeof body.total === "number" && Number.isFinite(body.total) ? body.total : 0;
    const limite = typeof body.limite === "number" && Number.isFinite(body.limite) ? body.limite : 0;

    const resumen = await generarResumenLegalizacionGemini({
      facturas,
      coordinador,
      sector,
      total,
      limite,
    });

    return NextResponse.json({ resumen });
  } catch {
    return NextResponse.json({ resumen: "Error al procesar la solicitud." });
  }
}
