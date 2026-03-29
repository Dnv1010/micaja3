import {
  getSheetData,
  getSheetDataBySpreadsheetId,
  updateSheetRow,
  updateSheetRowBySpreadsheetId,
} from "@/lib/sheets-helpers";
import type { SpreadsheetKey } from "@/lib/google-sheets";

function applyPatchToRow(
  headers: string[],
  current: string[] | undefined,
  patch: Record<string, string>
): string[] {
  const patchTrimmed: Record<string, string> = {};
  Object.entries(patch).forEach(([k, v]) => {
    patchTrimmed[String(k).trim()] = v;
  });
  return headers.map((h, i) => {
    const hk = String(h ?? "").trim();
    if (hk in patchTrimmed) return patchTrimmed[hk];
    return current?.[i] ?? "";
  });
}

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
  const next = applyPatchToRow(headers, current, patch);
  await updateSheetRow(spreadsheetKey, sheetName, rowIndex, next);
}

export async function mergeUpdateRowBySpreadsheetId(
  spreadsheetId: string,
  sheetName: string,
  rowIndex: number,
  patch: Record<string, string>
): Promise<void> {
  const rows = await getSheetDataBySpreadsheetId(spreadsheetId, sheetName);
  const headers = rows[0];
  if (!headers) return;
  const current = rows[rowIndex - 1];
  if (!current) return;
  const next = applyPatchToRow(headers, current, patch);
  await updateSheetRowBySpreadsheetId(spreadsheetId, sheetName, rowIndex, next);
}

export function buildAppendRow(
  headers: string[],
  data: Record<string, string>
): string[] {
  return headers.map((h) => data[h] ?? "");
}
