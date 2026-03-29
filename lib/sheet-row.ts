import { getSheetData, updateSheetRow } from "@/lib/sheets-helpers";
import type { SpreadsheetKey } from "@/lib/google-sheets";

export async function mergeUpdateRow(
  spreadsheetKey: SpreadsheetKey,
  sheetName: string,
  rowIndex: number,
  patch: Record<string, string>
): Promise<void> {
  const rows = await getSheetData(spreadsheetKey, sheetName);
  const headers = rows[0];
  if (!headers) return;
  const current = rows[rowIndex - 1];
  if (!current) return;
  const next = headers.map((h, i) => {
    if (h in patch) return patch[h];
    return current[i] ?? "";
  });
  await updateSheetRow(spreadsheetKey, sheetName, rowIndex, next);
}

export function buildAppendRow(
  headers: string[],
  data: Record<string, string>
): string[] {
  return headers.map((h) => data[h] ?? "");
}
