import type { SpreadsheetKey } from "@/lib/google-sheets";
import type { SessionCtx } from "@/lib/roles";

/**
 * Bogotá → PETTY_CASH, Costa Caribe → QUICKFUNDS.
 * En Vercel ambos IDs pueden ser el mismo hasta separar libros.
 */
export function spreadsheetKeyForSession(ctx: SessionCtx): SpreadsheetKey {
  const s = (ctx.sector || "").toLowerCase();
  if (s.includes("costa") || s.includes("caribe")) {
    return "QUICKFUNDS";
  }
  if (s.includes("bogota") || s.includes("bogotá")) {
    return "PETTY_CASH";
  }
  return "PETTY_CASH";
}
