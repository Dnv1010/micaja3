import { SPREADSHEET_IDS } from "@/lib/google-sheets";

export function defaultUsuariosSpreadsheetIdForPatch(bodySpreadsheetId?: string): string {
  const fromBody = bodySpreadsheetId?.trim();
  if (fromBody) return fromBody;
  const explicit = process.env.USUARIOS_SPREADSHEET_ID?.trim();
  if (explicit) return explicit;
  return SPREADSHEET_IDS.PETTY_CASH;
}
