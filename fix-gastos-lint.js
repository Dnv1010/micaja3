const fs = require("fs");
const f = "lib/telegram-gastos.ts";
let c = fs.readFileSync(f, "utf8");

// Quitar imports no usados
c = c.replace('import { getUsuariosFromSheet } from "@/lib/usuarios-sheet";\n', '');
c = c.replace('import { appendSheetRow, getSheetData } from "@/lib/sheets-helpers";', 'import { appendSheetRow } from "@/lib/sheets-helpers";');
c = c.replace('import { SHEET_NAMES, SPREADSHEET_IDS } from "@/lib/google-sheets";\n', '');

// Quitar parametro usuario no usado
c = c.replace('export async function procesarMensajeGastos(chatId, texto, usuario) {', 'export async function procesarMensajeGastos(chatId, texto, _usuario) {');

// Cambiar require por import
c = c.replace(
  'const resend = new (require("resend").Resend)(process.env.RESEND_API_KEY);',
  'const { Resend } = await import("resend");\n  const resend = new Resend(process.env.RESEND_API_KEY);'
);

fs.writeFileSync(f, c, "utf8");
console.log("✅ Listo");
