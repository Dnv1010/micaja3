import { assertSheetsConfigured, getSheetsClient, SHEET_NAMES, SPREADSHEET_IDS } from "@/lib/google-sheets";
import { quoteSheetTitleForRange, sheetValuesToRecords } from "@/lib/sheets-helpers";
import { parseMonto } from "@/lib/format";
import { normalizeSector } from "@/lib/sector-normalize";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";
import { responsablesEnZonaSheetSet } from "@/lib/usuarios-sheet";

export type MicajaBalanceRow = {
  responsable: string;
  totalRecibido: number;
  totalGastado: number;
  balance: number;
};

function spreadsheetId(): string {
  const id = SPREADSHEET_IDS.MICAJA.trim();
  if (!id) throw new Error("MICAJA_SPREADSHEET_ID no configurada");
  return id;
}

/** Solo "aprobada" suma al gastado del balance; "completada" y "pendiente" no. */
function facturaGastadoAprobada(f: Record<string, string>): boolean {
  const v = String(
    getCellCaseInsensitive(f, "Verificado", "Estado", "Legalizado") || ""
  )
    .toLowerCase()
    .trim();
  return v === "aprobada" || v === "completada";
}

/** Agrega montos por responsable desde Entregas y Facturas (hojas MiCaja). */
export async function loadMicajaBalancesByResponsable(opts?: {
  /** Si se indica, solo entregas de responsables de la zona y facturas aprobadas de la zona (por responsable o columna Sector normalizada). */
  sectorRaw?: string;
}): Promise<Map<string, { recibido: number; gastado: number }>> {
  assertSheetsConfigured();
  const sheets = getSheetsClient();
  const sid = spreadsheetId();
  const sectorRaw = opts?.sectorRaw?.trim();
  const zonaSet = sectorRaw ? await responsablesEnZonaSheetSet(sectorRaw) : null;
  const wantSec = sectorRaw ? normalizeSector(sectorRaw) : null;

  const [entRes, facRes] = await Promise.all([
    sheets.spreadsheets.values.get({
      spreadsheetId: sid,
      range: `${quoteSheetTitleForRange(SHEET_NAMES.ENTREGAS)}!A:H`,
    }),
    sheets.spreadsheets.values.get({
      spreadsheetId: sid,
      range: `${quoteSheetTitleForRange(SHEET_NAMES.FACTURAS)}!A:S`,
    }),
  ]);

  const entRows = entRes.data.values ?? [];
  const facRows = facRes.data.values ?? [];
  const entregas = sheetValuesToRecords(entRows);
  const facturas = sheetValuesToRecords(facRows);

  const map = new Map<string, { recibido: number; gastado: number }>();

  const bump = (resp: string, key: "recibido" | "gastado", amount: number) => {
    const k = resp.trim();
    if (!k) return;
    const cur = map.get(k) || { recibido: 0, gastado: 0 };
    cur[key] += amount;
    map.set(k, cur);
  };

  for (const row of entregas) {
    const r = String(row.Responsable || "").trim();
    if (zonaSet && !zonaSet.has(r.toLowerCase())) continue;
    const m = parseMonto(row.Monto_Entregado || row.Monto);
    bump(r, "recibido", m);
  }

  for (const row of facturas) {
    if (!facturaGastadoAprobada(row)) continue;
    const r = String(row.Responsable || "").trim();
    const rowSec = normalizeSector(getCellCaseInsensitive(row, "Sector") || "");
    if (zonaSet && !zonaSet.has(r.toLowerCase())) {
      if (wantSec === null || rowSec !== wantSec) continue;
    }
    const m = parseMonto(row.Monto_Factura || row.Valor);
    bump(r, "gastado", m);
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
