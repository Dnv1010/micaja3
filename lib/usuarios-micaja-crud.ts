import { getSheetsClient, assertSheetsConfigured, SPREADSHEET_IDS, SHEET_NAMES } from "@/lib/google-sheets";
import { getSheetDataBySpreadsheetId, quoteSheetTitleForRange } from "@/lib/sheets-helpers";
import { normalizeEmailForAuth } from "@/lib/email-normalize";

function tabName(): string {
  return process.env.USUARIOS_SHEET_NAME?.trim() || SHEET_NAMES.USUARIOS;
}

function spreadsheetId(): string {
  const id = SPREADSHEET_IDS.MICAJA.trim();
  if (!id) throw new Error("MICAJA_SPREADSHEET_ID no configurada");
  return id;
}

function a1ColumnLetter(zeroBasedIndex: number): string {
  let n = zeroBasedIndex + 1;
  let s = "";
  while (n > 0) {
    const mod = (n - 1) % 26;
    s = String.fromCharCode(65 + mod) + s;
    n = Math.floor((n - mod) / 26);
  }
  return s;
}

async function getSheetIdForTab(spreadsheetIdStr: string, title: string): Promise<number | null> {
  const res = await getSheetsClient().spreadsheets.get({
    spreadsheetId: spreadsheetIdStr,
    fields: "sheets(properties(sheetId,title))",
  });
  const found = res.data.sheets?.find((s) => s.properties?.title === title);
  return found?.properties?.sheetId ?? null;
}

function normHeader(h: string): string {
  return String(h || "")
    .trim()
    .toLowerCase()
    .replace(/\s/g, "");
}

function colIndex(headers: string[], ...aliases: string[]): number {
  const want = aliases.map((a) => normHeader(a));
  return headers.findIndex((h) => want.includes(normHeader(h)));
}

export type UsuarioMicajaInput = {
  responsable: string;
  email: string;
  telefono?: string;
  rol: string;
  userActive: boolean;
  area: string;
  sector: string;
  cargo: string;
  cedula: string;
  pin?: string;
};

/** Solo libro MiCaja — evita duplicar en Petty Cash. */
export async function appendUsuarioMicaja(input: UsuarioMicajaInput): Promise<void> {
  assertSheetsConfigured();
  const sid = spreadsheetId();
  const tab = tabName();
  const rows = await getSheetDataBySpreadsheetId(sid, tab, "A:AZ");
  if (rows.length < 1) throw new Error("Hoja Usuarios sin encabezados");
  const headers = rows[0].map((h) => String(h || "").trim());
  const row = new Array(headers.length).fill("");
  const setCol = (aliases: string[], v: string) => {
    const ix = colIndex(headers, ...aliases);
    if (ix >= 0) row[ix] = v;
  };
  setCol(["Responsable"], input.responsable.trim());
  setCol(["Correos", "Correo", "Email"], input.email.trim().toLowerCase());
  setCol(["Telefono", "Teléfono"], (input.telefono || "").trim());
  setCol(["Rol"], input.rol.trim());
  setCol(["UserActive", "Activo"], input.userActive ? "TRUE" : "FALSE");
  setCol(["Area"], input.area.trim());
  setCol(["Sector"], input.sector.trim());
  setCol(["Cargo"], input.cargo.trim());
  setCol(["Cedula", "Cédula"], input.cedula.trim());
  setCol(["PIN", "Pin"], (input.pin || "1234").trim());

  await getSheetsClient().spreadsheets.values.append({
    spreadsheetId: sid,
    range: `${quoteSheetTitleForRange(tab)}!A:Z`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
  });
}

export type UsuarioMicajaPatch = {
  email: string;
  userActive?: boolean;
  responsable?: string;
  correos?: string;
  telefono?: string;
  rol?: string;
  area?: string;
  sector?: string;
  cargo?: string;
  cedula?: string;
  pin?: string;
};

export async function patchUsuarioMicaja(patch: UsuarioMicajaPatch): Promise<number> {
  assertSheetsConfigured();
  const want = normalizeEmailForAuth(patch.email);
  if (!want) throw new Error("email inválido");

  const sid = spreadsheetId();
  const tab = tabName();
  const rows = await getSheetDataBySpreadsheetId(sid, tab, "A:AZ");
  if (rows.length < 2) return 0;
  const headers = rows[0].map((h) => String(h || "").trim());
  const emailCol = colIndex(headers, "Correos", "Correo", "Email", "E-mail");
  if (emailCol < 0) return 0;

  let updated = 0;
  const sheets = getSheetsClient();
  const quoted = quoteSheetTitleForRange(tab);

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const cell = normalizeEmailForAuth(String(row[emailCol] || ""));
    if (cell !== want) continue;

    const sheetRow = r + 1;
    const updates: { col: number; val: string }[] = [];

    const setIf = (aliases: string[], val: string | undefined) => {
      if (val === undefined) return;
      const ix = colIndex(headers, ...aliases);
      if (ix >= 0) updates.push({ col: ix, val });
    };

    if (typeof patch.userActive === "boolean") {
      setIf(["UserActive", "Activo"], patch.userActive ? "TRUE" : "FALSE");
    }
    setIf(["Responsable"], patch.responsable);
    setIf(["Correos", "Correo", "Email"], patch.correos ? patch.correos.trim().toLowerCase() : undefined);
    setIf(["Telefono", "Teléfono"], patch.telefono);
    setIf(["Rol"], patch.rol);
    setIf(["Area"], patch.area);
    setIf(["Sector"], patch.sector);
    setIf(["Cargo"], patch.cargo);
    setIf(["Cedula", "Cédula"], patch.cedula);
    setIf(["PIN", "Pin"], patch.pin);

    for (const u of updates) {
      const letter = a1ColumnLetter(u.col);
      await sheets.spreadsheets.values.update({
        spreadsheetId: sid,
        range: `${quoted}!${letter}${sheetRow}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [[u.val]] },
      });
    }
    updated += 1;
  }

  return updated;
}

export async function deleteUsuarioMicajaByEmail(email: string): Promise<boolean> {
  assertSheetsConfigured();
  const want = normalizeEmailForAuth(email);
  if (!want) throw new Error("email inválido");

  const sid = spreadsheetId();
  const tab = tabName();
  const rows = await getSheetDataBySpreadsheetId(sid, tab, "A:AZ");
  if (rows.length < 2) return false;
  const headers = rows[0].map((h) => String(h || "").trim());
  const emailCol = colIndex(headers, "Correos", "Correo", "Email", "E-mail");
  if (emailCol < 0) return false;

  for (let r = 1; r < rows.length; r++) {
    const cell = normalizeEmailForAuth(String(rows[r][emailCol] || ""));
    if (cell !== want) continue;

    const sheetIdNum = await getSheetIdForTab(sid, tab);
    if (sheetIdNum == null) return false;

    const startIndex = r;
    await getSheetsClient().spreadsheets.batchUpdate({
      spreadsheetId: sid,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheetIdNum,
                dimension: "ROWS",
                startIndex,
                endIndex: startIndex + 1,
              },
            },
          },
        ],
      },
    });
    return true;
  }

  return false;
}
