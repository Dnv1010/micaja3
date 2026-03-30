import { sheets, SPREADSHEET_IDS, assertSheetsConfigured, type SpreadsheetKey } from "./google-sheets";

/** Nombre de pestaña en notación A1 (comillas simples y escape de '). */
export function quoteSheetTitleForRange(sheetName: string): string {
  const t = sheetName.trim();
  return `'${t.replace(/'/g, "''")}'`;
}

export async function getSheetDataBySpreadsheetId(
  spreadsheetId: string,
  sheetName: string,
  range?: string
): Promise<string[][]> {
  assertSheetsConfigured();
  if (!spreadsheetId?.trim()) return [];
  const quoted = quoteSheetTitleForRange(sheetName);
  const fullRange = range ? `${quoted}!${range}` : quoted;
  const response = await sheets!.spreadsheets.values.get({
    spreadsheetId: spreadsheetId.trim(),
    range: fullRange,
  });
  return response.data.values ?? [];
}

export async function getSheetData(
  spreadsheetKey: SpreadsheetKey,
  sheetName: string,
  range?: string
): Promise<string[][]> {
  const id = SPREADSHEET_IDS[spreadsheetKey];
  return getSheetDataBySpreadsheetId(id, sheetName, range);
}

export async function updateSheetRowBySpreadsheetId(
  spreadsheetId: string,
  sheetName: string,
  rowIndex: number,
  values: unknown[]
): Promise<void> {
  assertSheetsConfigured();
  await sheets!.spreadsheets.values.update({
    spreadsheetId: spreadsheetId.trim(),
    range: `${quoteSheetTitleForRange(sheetName)}!A${rowIndex}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [values as string[]] },
  });
}

export async function appendSheetRow(
  spreadsheetKey: SpreadsheetKey,
  sheetName: string,
  values: unknown[]
): Promise<void> {
  assertSheetsConfigured();
  await sheets!.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_IDS[spreadsheetKey],
    range: quoteSheetTitleForRange(sheetName),
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [values as string[]] },
  });
}

export async function updateSheetRow(
  spreadsheetKey: SpreadsheetKey,
  sheetName: string,
  rowIndex: number,
  values: unknown[]
): Promise<void> {
  assertSheetsConfigured();
  await sheets!.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_IDS[spreadsheetKey],
    range: `${quoteSheetTitleForRange(sheetName)}!A${rowIndex}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [values as string[]] },
  });
}

export async function deleteSheetRow(
  spreadsheetKey: SpreadsheetKey,
  sheetName: string,
  sheetId: number,
  rowIndex: number
): Promise<void> {
  assertSheetsConfigured();
  await sheets!.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_IDS[spreadsheetKey],
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: rowIndex,
              endIndex: rowIndex + 1,
            },
          },
        },
      ],
    },
  });
}

export async function getSheetId(
  spreadsheetKey: SpreadsheetKey,
  sheetName: string
): Promise<number | null> {
  assertSheetsConfigured();
  const res = await sheets!.spreadsheets.get({
    spreadsheetId: SPREADSHEET_IDS[spreadsheetKey],
    fields: "sheets(properties(sheetId,title))",
  });
  const found = res.data.sheets?.find((s) => s.properties?.title === sheetName);
  return found?.properties?.sheetId ?? null;
}

export function rowsToObjects<T>(rows: string[][]): T[] {
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map((row, index) => {
    const obj: Record<string, string | number> = { _rowIndex: index + 2 };
    headers.forEach((header, i) => {
      const key = String(header ?? "").trim();
      if (!key) return;
      const cell = String(row[i] ?? "").trim();
      obj[key] = cell;
    });
    return obj as T;
  });
}

export function rowToArrayByHeaders(headers: string[], row: Record<string, string>): string[] {
  return headers.map((h) => String(row[h] ?? ""));
}
