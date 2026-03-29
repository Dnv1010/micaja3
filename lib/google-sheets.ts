import { google } from "googleapis";

const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

const auth =
  clientEmail && privateKey
    ? new google.auth.GoogleAuth({
        credentials: {
          client_email: clientEmail,
          private_key: privateKey,
        },
        scopes: [
          "https://www.googleapis.com/auth/spreadsheets",
          "https://www.googleapis.com/auth/drive",
        ],
      })
    : null;

export const sheets = auth
  ? google.sheets({ version: "v4", auth })
  : null;

export const drive = auth ? google.drive({ version: "v3", auth }) : null;

export function assertSheetsConfigured(): void {
  if (!sheets || !drive) {
    throw new Error(
      "Google API no configurada: defina GOOGLE_SERVICE_ACCOUNT_EMAIL y GOOGLE_PRIVATE_KEY"
    );
  }
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
