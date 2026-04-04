/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { formatCOP } from "@/lib/format";
import { verifyInternalApiKey } from "@/lib/internal-api";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const internalKey = req.headers.get("x-internal-key") || "";
  const session = await getServerSession(authOptions);
  if (!verifyInternalApiKey(internalKey) && !session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const { nombre, cargo, cc, ciudad, motivo, fechaInicio, fechaFin, facturas } = body;

  const total = facturas.reduce((acc: number, f: any) => acc + Number(String(f.valor).replace(/[^0-9]/g, "")), 0);

  const filas = facturas.map((f: any, i: number) => `
    <tr style="background:${i%2===0?"#f9f9f9":"white"}">
      <td style="padding:6px;border:1px solid #ddd;text-align:center">${i+1}</td>
      <td style="padding:6px;border:1px solid #ddd">${f.concepto}</td>
      <td style="padding:6px;border:1px solid #ddd">${f.centroCostos}</td>
      <td style="padding:6px;border:1px solid #ddd">${f.nit||""}</td>
      <td style="padding:6px;border:1px solid #ddd;text-align:center">${f.fecha}</td>
      <td style="padding:6px;border:1px solid #ddd;text-align:right">${formatCOP(Number(String(f.valor).replace(/[^0-9]/g,"")))}</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
  body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
  .header { background: #001035; color: white; padding: 16px; border-radius: 4px; margin-bottom: 16px; }
  .header h2 { color: #08DDBC; margin: 0; }
  .info-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  .info-table td { padding: 6px 8px; }
  .info-table .label { font-weight: bold; color: #555; width: 120px; }
  table.facturas { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  table.facturas th { background: #001035; color: white; padding: 8px; border: 1px solid #ddd; }
  .total-row { background: #001035; color: white; }
  .total-row td { padding: 8px; border: 1px solid #ddd; text-align: right; font-weight: bold; }
  .footer { font-size: 10px; color: #666; margin-top: 16px; border-top: 1px solid #ddd; padding-top: 8px; }
  .firma-box { border: 1px solid #ddd; padding: 40px 20px 8px; margin-top: 8px; }
</style></head>
<body>
  <div class="header">
    <h2>⚡ BIA Energy SAS ESP</h2>
    <p style="margin:4px 0 0">Legalización de Gastos</p>
  </div>
  <table class="info-table">
    <tr><td class="label">Nombre:</td><td>${nombre}</td><td class="label">Cargo:</td><td>${cargo}</td></tr>
    <tr><td class="label">CC:</td><td>${cc}</td><td class="label">Ciudad:</td><td>${ciudad||""}</td></tr>
    <tr><td class="label">Motivo:</td><td colspan="3">${motivo||""}</td></tr>
    <tr><td class="label">Periodo:</td><td colspan="3">${fechaInicio||""} al ${fechaFin||""}</td></tr>
  </table>
  <table class="facturas">
    <thead><tr>
      <th>No.</th><th>Concepto</th><th>Centro Costos</th><th>NIT</th><th>Fecha</th><th>Valor</th>
    </tr></thead>
    <tbody>${filas}</tbody>
    <tfoot><tr class="total-row">
      <td colspan="5" style="text-align:right">TOTAL:</td>
      <td>${formatCOP(total)}</td>
    </tr></tfoot>
  </table>
  <div style="display:flex;gap:20px;margin-top:20px">
    <div style="flex:1"><p><b>Empleado que Legaliza:</b></p><div class="firma-box"></div></div>
    <div style="flex:1"><p><b>Jefe Directo (Aprueba):</b></p><div class="firma-box"></div></div>
  </div>
  <div class="footer">(1) TODOS LOS GASTOS DEBEN ENCONTRARSE DEBIDAMENTE SOPORTADOS Y TODAS LAS FACTURAS DEBEN ESTAR A NOMBRE DE BIA ENERGY S.A.S. E.S.P</div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
