import { google } from "googleapis";

function getCredentials() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY ?? "";
  const privateKey = rawKey.includes("\\n")
    ? rawKey.replace(/\\n/g, "\n")
    : rawKey;

  if (!clientEmail || !privateKey) {
    throw new Error(
      "Google API no configurada: defina GOOGLE_SERVICE_ACCOUNT_EMAIL y GOOGLE_PRIVATE_KEY"
    );
  }

  return { clientEmail, privateKey };
}

function getAuth() {
  const { clientEmail, privateKey } = getCredentials();
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive",
    ],
  });
}

export function getSheetsClient() {
  return google.sheets({ version: "v4", auth: getAuth() });
}

export function getDriveClient() {
  return google.drive({ version: "v3", auth: getAuth() });
}

export function assertSheetsConfigured(): void {
  getCredentials();
}

export const SPREADSHEET_IDS = {
  PETTY_CASH: process.env.PETTY_CASH_SPREADSHEET_ID ?? "",
  QUICKFUNDS: process.env.QUICKFUNDS_SPREADSHEET_ID ?? "",
  MICAJA: process.env.MICAJA_SPREADSHEET_ID ?? "",
} as const;

export type SpreadsheetKey = keyof typeof SPREADSHEET_IDS;

export const SHEET_NAMES = {
  ENTREGAS: "Entregas",
  FACTURAS: "Facturas",
  TIPO_FACTURA: "Tipo de Factura",
  USUARIOS: "Usuarios",
  LEGALIZACIONES: "Legalizaciones",
  ENVIO: "Envio",
  SERVICIO_DECLARADO: "Servicio declarado",
  PARAMETROS_PDF: "ParametrosPdf",
  CIUDAD: "Ciudad",
  BALANCE: "Balance",
} as const;

export function getSheets() {
  return getSheetsClient();
}

export function getDrive() {
  return getDriveClient();
}
