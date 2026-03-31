import { SHEET_NAMES } from "@/lib/google-sheets";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";
import { loadMicajaFacturasSheetRows, mapEstadoPatchToSheet } from "@/lib/micaja-facturas-sheet";
import { mergeUpdateRow } from "@/lib/sheet-row";
import { rowsToObjects } from "@/lib/sheets-helpers";
import type { FacturaRow } from "@/types/models";

function facturaIdCell(f: FacturaRow): string {
  return getCellCaseInsensitive(f, "ID_Factura", "ID");
}

/** Actualiza Legalizado/Verificado/Estado en la hoja (uso servidor, p. ej. legalizaciones). */
export async function applyFacturaEstadoById(
  id: string,
  estado: string,
  motivoRechazo = ""
): Promise<{ ok: true } | { ok: false; error: string }> {
  const rows = await loadMicajaFacturasSheetRows();
  const headers = rows[0] || [];
  const list = rowsToObjects<FacturaRow>(rows);
  const found = list.find((f) => facturaIdCell(f) === id);
  if (!found) return { ok: false, error: "not_found" };
  const patch = mapEstadoPatchToSheet(headers, estado, motivoRechazo);
  await mergeUpdateRow("MICAJA", SHEET_NAMES.FACTURAS, found._rowIndex, patch);
  return { ok: true };
}
