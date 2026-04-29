import { getSupabase } from "@/lib/supabase";
import { normalizeSector } from "@/lib/sector-normalize";
import { responsablesEnZonaSheetSet } from "@/lib/usuarios-sheet";
import { TABLES } from "@/lib/db-tables";

export type MicajaBalanceRow = {
  responsable: string;
  totalRecibido: number;
  totalGastado: number;
  balance: number;
};

/** Facturas que cuentan como gastado: Aprobada o Completada. */
const ESTADOS_GASTADO = new Set(["Aprobada", "Completada"]);

/** Agrega montos por responsable desde entregas y facturas en Supabase. */
export async function loadMicajaBalancesByResponsable(opts?: {
  sectorRaw?: string;
}): Promise<Map<string, { recibido: number; gastado: number }>> {
  const sb = getSupabase();
  const sectorRaw = opts?.sectorRaw?.trim();
  const zonaSet = sectorRaw ? await responsablesEnZonaSheetSet(sectorRaw) : null;
  const wantSec = sectorRaw ? normalizeSector(sectorRaw) : null;

  async function fetchAll<T>(
    build: () => ReturnType<typeof sb.from>,
    cols: string
  ): Promise<T[]> {
    const PAGE = 1000;
    const out: T[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await build()
        .select(cols)
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const batch = (data ?? []) as unknown as T[];
      out.push(...batch);
      if (batch.length < PAGE) break;
    }
    return out;
  }

  const [entData, facData] = await Promise.all([
    fetchAll<{ assignee: string | null; delivered_amount: number | string | null }>(
      () => sb.from(TABLES.deliveries),
      "assignee, delivered_amount"
    ),
    fetchAll<{
      assignee: string | null;
      invoice_amount: number | string | null;
      status: string | null;
      region: string | null;
    }>(
      () => sb.from(TABLES.invoices),
      "assignee, invoice_amount, status, region"
    ),
  ]);

  const map = new Map<string, { recibido: number; gastado: number }>();
  const bump = (
    resp: string,
    key: "recibido" | "gastado",
    amount: number
  ) => {
    const k = resp.trim();
    if (!k || !amount) return;
    const cur = map.get(k) || { recibido: 0, gastado: 0 };
    cur[key] += amount;
    map.set(k, cur);
  };

  for (const row of entData) {
    const r = String(row.assignee ?? "").trim();
    if (zonaSet && !zonaSet.has(r.toLowerCase())) continue;
    const m = Number(row.delivered_amount ?? 0);
    if (Number.isFinite(m)) bump(r, "recibido", m);
  }

  for (const row of facData) {
    const estado = String(row.status ?? "").trim();
    if (!ESTADOS_GASTADO.has(estado)) continue;
    const r = String(row.assignee ?? "").trim();
    const rowSec = normalizeSector(String(row.region ?? ""));
    if (zonaSet && !zonaSet.has(r.toLowerCase())) {
      if (wantSec === null || rowSec !== wantSec) continue;
    }
    const m = Number(row.invoice_amount ?? 0);
    if (Number.isFinite(m)) bump(r, "gastado", m);
  }

  return map;
}

export function mapToBalanceRows(
  map: Map<string, { recibido: number; gastado: number }>,
  responsableFilter?: string
): MicajaBalanceRow[] {
  const rows: MicajaBalanceRow[] = [];
  const filter = responsableFilter?.trim().toLowerCase();
  map.forEach((v, responsable) => {
    if (filter && responsable.toLowerCase() !== filter) return;
    rows.push({
      responsable,
      totalRecibido: v.recibido,
      totalGastado: v.gastado,
      balance: v.recibido - v.gastado,
    });
  });
  rows.sort((a, b) => a.responsable.localeCompare(b.responsable, "es"));
  return rows;
}
