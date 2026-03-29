import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { SHEET_NAMES } from "@/lib/google-sheets";
import { getSheetData, rowsToObjects } from "@/lib/sheets-helpers";
import { mergeUpdateRow } from "@/lib/sheet-row";
import type { EnvioRow, LegalizacionRow, UsuarioRow } from "@/types/models";
import { sedeFromUsuarioSector } from "@/lib/saldo";
import { parseCOPString } from "@/lib/format";
import { revalidateSheet } from "@/lib/revalidate-sheets";

function parseMonto(s: string): number {
  return parseCOPString(s || "0");
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if ((session.user.rol || "").toLowerCase() !== "coordinador") {
    return NextResponse.json({ error: "Solo coordinador" }, { status: 403 });
  }

  try {
    const [envRows, legRows, userRows, balRows] = await Promise.all([
      getSheetData("PETTY_CASH", SHEET_NAMES.ENVIO),
      getSheetData("PETTY_CASH", SHEET_NAMES.LEGALIZACIONES),
      getSheetData("PETTY_CASH", SHEET_NAMES.USUARIOS),
      getSheetData("MICAJA", SHEET_NAMES.BALANCE),
    ]);

    const envios = rowsToObjects<EnvioRow>(envRows);
    const legalizaciones = rowsToObjects<LegalizacionRow>(legRows);
    const usuarios = rowsToObjects<UsuarioRow>(userRows);
    const byName = new Map(usuarios.map((u) => [u.Responsable, u] as const));

    type Sede = "Bogota" | "Costa Caribe";
    const sumEnvios = (sede: Sede) =>
      envios.reduce((acc, e) => {
        const u = byName.get(e.Responsable || "");
        if (!u) return acc;
        if (sedeFromUsuarioSector(u.Sector) !== sede) return acc;
        return acc + parseMonto(e.Monto);
      }, 0);

    const sumLeg = (sede: Sede) =>
      legalizaciones.reduce((acc, l) => {
        const u = byName.get(l.Responsable || "");
        if (!u) return acc;
        if (sedeFromUsuarioSector(u.Sector) !== sede) return acc;
        return acc + parseMonto(l.Total_Legalizado);
      }, 0);

    const stored = rowsToObjects<Record<string, string> & { _rowIndex: number }>(balRows);
    const sedes: Sede[] = ["Bogota", "Costa Caribe"];

    const data = sedes.map((sede) => {
      const entregado = sumEnvios(sede);
      const facturas = sumLeg(sede);
      const totalReg = entregado - facturas;
      const row = stored.find(
        (r) => String(r.Sede || "").toLowerCase().includes(sede.toLowerCase().split(" ")[0])
      );
      const retiro = row ? parseMonto(String(row.Retiro || "0")) : 0;
      const cuatro = Math.round(retiro * 0.004);
      const iva = Math.round(retiro * 0.19);
      return {
        sede,
        _rowIndex: row?._rowIndex,
        ValorTotalEntregado: entregado,
        ValorTotalFacturas: facturas,
        TotalRegistrado: totalReg,
        Retiro: retiro,
        "4x1000": cuatro,
        Iva: iva,
        FotoRetiro: row?.FotoRetiro || "",
        usuario: row?.usuario || "",
      };
    });

    return NextResponse.json({ data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if ((session.user.rol || "").toLowerCase() !== "coordinador") {
    return NextResponse.json({ error: "Solo coordinador" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as { rowIndex: number; Retiro?: string; FotoRetiro?: string };
    if (!body.rowIndex) return NextResponse.json({ error: "rowIndex" }, { status: 400 });

    const patch: Record<string, string> = {};
    if (body.Retiro !== undefined) patch.Retiro = body.Retiro;
    if (body.FotoRetiro !== undefined) patch.FotoRetiro = body.FotoRetiro;

    const retiro = parseMonto(patch.Retiro || "0");
    patch["4x1000"] = String(Math.round(retiro * 0.004));
    patch.Iva = String(Math.round(retiro * 0.19));

    await mergeUpdateRow("MICAJA", SHEET_NAMES.BALANCE, body.rowIndex, patch);
    revalidateSheet("MICAJA", SHEET_NAMES.BALANCE);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
