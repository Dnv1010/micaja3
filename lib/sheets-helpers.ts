import {
  getSheetsClient,
  SPREADSHEET_IDS,
  SHEET_NAMES,
  assertSheetsConfigured,
  type SpreadsheetKey,
} from "./google-sheets";

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
  const response = await getSheetsClient().spreadsheets.values.get({
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
  await getSheetsClient().spreadsheets.values.update({
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
  await getSheetsClient().spreadsheets.values.append({
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
  await getSheetsClient().spreadsheets.values.update({
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
  await getSheetsClient().spreadsheets.batchUpdate({
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
  const res = await getSheetsClient().spreadsheets.get({
    spreadsheetId: SPREADSHEET_IDS[spreadsheetKey],
    fields: "sheets(properties(sheetId,title))",
  });
  const found = res.data.sheets?.find((s) => s.properties?.title === sheetName);
  return found?.properties?.sheetId ?? null;
}

function facturasHeaderHasNumFactura(headers: string[]): boolean {
  return headers.some((h) => {
    const n = String(h ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[áàäâ]/g, "a")
      .replace(/[éèëê]/g, "e")
      .replace(/[íìïî]/g, "i")
      .replace(/[óòöô]/g, "o")
      .replace(/[úùüû]/g, "u")
      .replace(/ñ/g, "n");
    return n === "numfactura" || n === "no.factura" || n === "numerodefactura";
  });
}

function facturasInsertIndexForNumFactura(headers: string[]): number {
  const norm = (s: string) => String(s ?? "").trim().toLowerCase();
  const nit = headers.findIndex((h) => norm(h) === "nit");
  if (nit >= 0) return nit + 1;
  const concepto = headers.findIndex((h) => norm(h) === "concepto");
  if (concepto >= 0) return concepto;
  return Math.min(8, Math.max(0, headers.length));
}

/** Inserta columna `NumFactura` tras NIT (o antes de Concepto) si la hoja Facturas aún no la tiene. */
export async function ensureMicajaFacturasNumFacturaColumn(): Promise<void> {
  assertSheetsConfigured();
  const spreadsheetKey = "MICAJA";
  const sheetName = SHEET_NAMES.FACTURAS;
  const rows = await getSheetData(spreadsheetKey, sheetName);
  if (!rows.length || !rows[0]?.some((c) => String(c ?? "").trim())) return;

  const headers = rows[0].map((c) => String(c ?? "").trim());
  if (facturasHeaderHasNumFactura(headers)) return;

  const insertAt = facturasInsertIndexForNumFactura(headers);
  const sheetId = await getSheetId(spreadsheetKey, sheetName);
  if (sheetId == null) return;

  await getSheetsClient().spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_IDS[spreadsheetKey],
    requestBody: {
      requests: [
        {
          insertDimension: {
            range: {
              sheetId,
              dimension: "COLUMNS",
              startIndex: insertAt,
              endIndex: insertAt + 1,
            },
          },
        },
      ],
    },
  });

  const fresh = await getSheetData(spreadsheetKey, sheetName);
  const r1 = [...(fresh[0] ?? [])];
  while (r1.length < insertAt + 1) r1.push("");
  r1[insertAt] = "NumFactura";
  await updateSheetRow(spreadsheetKey, sheetName, 1, r1);
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

/** Filas de Sheet → objetos planos (sin `_rowIndex`), según encabezados de la fila 1. */
export function sheetValuesToRecords(rows: string[][]): Record<string, string>[] {
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((header, i) => {
      const key = String(header ?? "").trim();
      if (!key) return;
      obj[key] = String(row[i] ?? "").trim();
    });
    return obj;
  });
}

export function rowToArrayByHeaders(headers: string[], row: Record<string, string>): string[] {
  return headers.map((h) => String(row[h] ?? ""));
}
