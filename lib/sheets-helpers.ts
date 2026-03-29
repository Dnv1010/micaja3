import { sheets, SPREADSHEET_IDS, assertSheetsConfigured, type SpreadsheetKey } from "./google-sheets";

export async function getSheetData(
  spreadsheetKey: SpreadsheetKey,
  sheetName: string,
  range?: string
): Promise<string[][]> {
  assertSheetsConfigured();
  const fullRange = range ? `${sheetName}!${range}` : sheetName;
  const response = await sheets!.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_IDS[spreadsheetKey],
    range: fullRange,
  });
  return response.data.values ?? [];
}

export async function appendSheetRow(
  spreadsheetKey: SpreadsheetKey,
  sheetName: string,
  values: unknown[]
): Promise<void> {
  assertSheetsConfigured();
  await sheets!.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_IDS[spreadsheetKey],
    range: sheetName,
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
    range: `${sheetName}!A${rowIndex}`,
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
      obj[header] = row[i] ?? "";
    });
    return obj as T;
  });
}

export function rowToArrayByHeaders(headers: string[], row: Record<string, string>): string[] {
  return headers.map((h) => String(row[h] ?? ""));
}
