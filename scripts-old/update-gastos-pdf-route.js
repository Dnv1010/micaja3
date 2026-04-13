const fs = require("fs");

const route = `/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { GastosPdf } from "@/components/pdf/gastos-pdf";
import { verifyInternalApiKey } from "@/lib/internal-api";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import React from "react";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!verifyInternalApiKey(req) && !session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const { nombre, cargo, cc, ciudad, motivo, fechaInicio, fechaFin, facturas } = body;
  
  const pdfBuffer = await renderToBuffer(
    React.createElement(GastosPdf, { nombre, cargo, cc, ciudad, motivo, fechaInicio, fechaFin, facturas })
  );

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=Legalizacion_Gastos.pdf",
    },
  });
}
`;

fs.writeFileSync("app/api/gastos-pdf/route.ts", route, "utf8");
console.log("✅ Route actualizada");
