import { revalidateTag } from "next/cache";
import type { SpreadsheetKey } from "@/lib/google-sheets";

export function revalidateSheet(spreadsheetKey: SpreadsheetKey, sheetName: string) {
  try {
    revalidateTag(`sheet-${spreadsheetKey}-${sheetName}`);
  } catch {
    /* fuera de request (tests) */
  }
}
