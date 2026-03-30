import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { SHEET_NAMES } from "@/lib/google-sheets";
import { getSheetData, rowsToObjects } from "@/lib/sheets-helpers";
import { loadUsuariosMerged } from "@/lib/usuarios-data";
import { filterEntregasWithUsuarios, filterFacturas } from "@/lib/roles";
import { spreadsheetKeyForSession } from "@/lib/spreadsheet-key";
import { computeSaldoResponsable } from "@/lib/saldo";
import type { BalanceRow, EntregaRow, FacturaRow, LegalizacionRow } from "@/types/models";
import { parseCOPString, parseSheetDate } from "@/lib/format";
import {
  balanceSaldo,
  entregaEstado,
  entregaFecha,
  entregaMonto,
  entregaResponsable,
  entregaRowId,
  facturaConcepto,
  facturaEstado,
  facturaFecha,
  facturaNit,
  facturaProveedor,
  facturaResponsable,
  facturaRowId,
  facturaTipo,
  facturaValor,
} from "@/lib/row-fields";
import { sessionCtxFromSession } from "@/lib/session-ctx";

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function isFacturaPendiente(f: FacturaRow): boolean {
  const st = (facturaEstado(f) || "").toLowerCase();
  if (st.includes("pendiente")) return true;
  if (st.includes("completado")) return false;
  return st === "" || !st.includes("legaliz");
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const ctx = sessionCtxFromSession(session);
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const key = spreadsheetKeyForSession(ctx);

  try {
    let balanceRows: string[][] = [];
    try {
      balanceRows = await getSheetData("MICAJA", SHEET_NAMES.BALANCE);
    } catch {
      balanceRows = [];
    }

    const [entRows, factRows, legRows, usuarios] = await Promise.all([
      getSheetData(key, SHEET_NAMES.ENTREGAS),
      getSheetData(key, SHEET_NAMES.FACTURAS),
      getSheetData(key, SHEET_NAMES.LEGALIZACIONES),
      loadUsuariosMerged(),
    ]);

    const entregas = filterEntregasWithUsuarios(rowsToObjects<EntregaRow>(entRows), ctx, usuarios);
    const facturas = filterFacturas(rowsToObjects<FacturaRow>(factRows), ctx, usuarios);
    const legalizacionesAll = rowsToObjects<LegalizacionRow>(legRows);
    const balanceList = rowsToObjects<BalanceRow>(balanceRows);

    const saldoUsuario = computeSaldoResponsable(
      ctx.responsable,
      rowsToObjects<EntregaRow>(entRows),
      legalizacionesAll
    );

    let saldoCajaActual = 0;
    if (balanceList.length > 0) {
      const last = balanceList[balanceList.length - 1];
      saldoCajaActual = parseCOPString(balanceSaldo(last) || "0");
    }

    const now = new Date();
    const startMes = new Date(now.getFullYear(), now.getMonth(), 1);
    let totalFacturasMes = 0;
    let countFacturasMes = 0;
    for (const f of facturas) {
      const d = parseSheetDate(facturaFecha(f));
      if (d && d >= startMes) {
        countFacturasMes += 1;
        totalFacturasMes += parseCOPString(facturaValor(f) || "0");
      }
    }

    const facturasPendientes = facturas.filter(isFacturaPendiente).length;

    const entregasActivas = entregas.filter((e) => {
      const st = (entregaEstado(e) || "").toLowerCase();
      return st !== "no" && st !== "rechazado" && st !== "cerrado";
    }).length;

    const monthTotals = new Map<string, number>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthTotals.set(monthKey(d), 0);
    }
    for (const f of facturas) {
      const d = parseSheetDate(facturaFecha(f));
      if (!d) continue;
      const mk = monthKey(d);
      if (!monthTotals.has(mk)) continue;
      monthTotals.set(mk, (monthTotals.get(mk) || 0) + parseCOPString(facturaValor(f) || "0"));
    }
    const gastosPorMes: { mes: string; label: string; total: number }[] = [];
    Array.from(monthTotals.entries()).forEach(([mk, total]) => {
      const [y, m] = mk.split("-").map(Number);
      const label = new Date(y, m - 1, 1).toLocaleDateString("es-CO", { month: "short", year: "2-digit" });
      gastosPorMes.push({ mes: mk, label, total });
    });
    gastosPorMes.sort((a, b) => a.mes.localeCompare(b.mes));

    const ultimasFacturas = [...facturas]
      .sort((a, b) => {
        const da = parseSheetDate(facturaFecha(a))?.getTime() ?? 0;
        const db = parseSheetDate(facturaFecha(b))?.getTime() ?? 0;
        return db - da;
      })
      .slice(0, 5)
      .map((f) => ({
        id: facturaRowId(f),
        fecha: facturaFecha(f),
        proveedor: facturaProveedor(f),
        nit: facturaNit(f),
        concepto: facturaConcepto(f),
        valor: facturaValor(f),
        tipo: facturaTipo(f),
        estado: facturaEstado(f),
        responsable: facturaResponsable(f),
      }));

    const sortedEnt = [...entregas].sort(
      (a, b) =>
        (parseSheetDate(entregaFecha(b))?.getTime() ?? 0) -
        (parseSheetDate(entregaFecha(a))?.getTime() ?? 0)
    );
    const ultimasEntregas = sortedEnt.slice(0, 3).map((e) => ({
      id: entregaRowId(e),
      Fecha_Entrega: entregaFecha(e),
      Responsable: entregaResponsable(e),
      Monto_Entregado: entregaMonto(e),
      montoNum: parseCOPString(entregaMonto(e) || "0"),
    }));

    return NextResponse.json({
      saldo: saldoUsuario,
      saldoCajaActual,
      facturasPendientes,
      facturasMes: { count: countFacturasMes, total: totalFacturasMes },
      entregasActivas,
      gastosPorMes,
      ultimasFacturas,
      ultimasEntregas,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al cargar el panel";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
