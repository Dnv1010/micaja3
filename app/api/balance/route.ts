import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { SHEET_NAMES } from "@/lib/google-sheets";
import { getSheetData, rowsToObjects } from "@/lib/sheets-helpers";
import { loadUsuariosMerged } from "@/lib/usuarios-data";
import { mergeUpdateRow } from "@/lib/sheet-row";
import type { EnvioRow, LegalizacionRow } from "@/types/models";
import { sedeFromUsuarioSector } from "@/lib/saldo";
import { parseCOPString } from "@/lib/format";
import { revalidateSheet } from "@/lib/revalidate-sheets";
import { sessionCtxFromSession } from "@/lib/session-ctx";
import { spreadsheetKeyForSession } from "@/lib/spreadsheet-key";
import { envioMonto, envioResponsable, legalizacionResponsable, legalizacionTotal } from "@/lib/row-fields";

function parseMonto(s: string): number {
  return parseCOPString(s || "0");
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const ctx = sessionCtxFromSession(session);
  if (!ctx) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const rol = ctx.rol.toLowerCase();
  if (rol !== "coordinador" && rol !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const key = spreadsheetKeyForSession(ctx);

  try {
    const [envRows, legRows, usuarios, balRows] = await Promise.all([
      getSheetData(key, SHEET_NAMES.ENVIO),
      getSheetData(key, SHEET_NAMES.LEGALIZACIONES),
      loadUsuariosMerged(),
      getSheetData("MICAJA", SHEET_NAMES.BALANCE),
    ]);

    const envios = rowsToObjects<EnvioRow>(envRows);
    const legalizaciones = rowsToObjects<LegalizacionRow>(legRows);
    const byName = new Map(usuarios.map((u) => [u.Responsable, u] as const));

    type Sede = "Bogota" | "Costa Caribe";
    const sumEnvios = (sede: Sede) =>
      envios.reduce((acc, e) => {
        const u = byName.get(envioResponsable(e) || "");
        if (!u) return acc;
        if (sedeFromUsuarioSector(u.Sector) !== sede) return acc;
        return acc + parseMonto(envioMonto(e));
      }, 0);

    const sumLeg = (sede: Sede) =>
      legalizaciones.reduce((acc, l) => {
        const u = byName.get(legalizacionResponsable(l) || "");
        if (!u) return acc;
        if (sedeFromUsuarioSector(u.Sector) !== sede) return acc;
        return acc + parseMonto(legalizacionTotal(l));
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
    const msg = e instanceof Error ? e.message : "Error al leer balance";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const ctx = sessionCtxFromSession(session);
  if (!ctx) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const rol = ctx.rol.toLowerCase();
  if (rol !== "coordinador" && rol !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
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
