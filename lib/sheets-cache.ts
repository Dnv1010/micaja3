import { unstable_cache } from "next/cache";
import { getSheetData } from "./sheets-helpers";
import type { SpreadsheetKey } from "./google-sheets";

const REVALIDATE_SECONDS = 30;

export function getCachedSheetData(
  spreadsheetKey: SpreadsheetKey,
  sheetName: string,
  range?: string
) {
  const tag = `sheet-${spreadsheetKey}-${sheetName}`;
  return unstable_cache(
    async () => getSheetData(spreadsheetKey, sheetName, range),
    [spreadsheetKey, sheetName, range ?? "all"],
    { revalidate: REVALIDATE_SECONDS, tags: [tag] }
  )();
}
