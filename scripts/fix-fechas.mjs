/**
 * Corrige fecha_factura de las 19 filas insertadas donde el parseo quedó mal
 * (DD/MM interpretado como MM/DD o quedó NULL).
 *
 * Uso:
 *   node scripts/fix-fechas.mjs --dry-run
 *   node scripts/fix-fechas.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { readFileSync } from 'fs';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const DRY_RUN = process.argv.includes('--dry-run');
const NEW_IDS = [
  '5458e5d2','a3bcacb3','814a3253','0f3d0c27','7590c078','bf9c01d1','83ea6bdf',
  '0bf6b706','65d95cef','2e1b6ba5','1c819c4a','29f9d07a','4eca5003','d12e1e93',
  'def328e2','6976308f','05635b54','3bb93f68','f763ffb1'
];

const parseDate = v => {
  if (!v) return null;
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    const d = parseInt(dd, 10), mo = parseInt(mm, 10);
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) {
      return `${yyyy}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    }
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
};

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const creds = JSON.parse(readFileSync('./google-credentials.json', 'utf8'));
const auth = new google.auth.JWT({
  email: creds.client_email, key: creds.private_key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
await auth.authorize();
const sheetsApi = google.sheets({ version: 'v4', auth });

const res = await sheetsApi.spreadsheets.values.get({
  spreadsheetId: process.env.MICAJA_SPREADSHEET_ID, range: 'Facturas!A:Z',
});
const rows = res.data.values;
const headers = rows[0].map(h => String(h).trim());
const data = rows.slice(1).map(r => {
  const o = {};
  headers.forEach((h, i) => { o[h] = r[i] ?? ''; });
  return o;
});
const sheetById = new Map();
data.forEach(r => {
  const id = String(r.ID_Factura || r.ID || '').trim();
  if (id) sheetById.set(id, r);
});

console.log(DRY_RUN ? '🧪 DRY-RUN' : '🚀 FIX REAL');
console.log('─'.repeat(80));

const updates = [];
for (const id of NEW_IDS) {
  const sh = sheetById.get(id);
  if (!sh) { console.log(`  ⚠️  ${id} no está en sheet (raro)`); continue; }
  const fechaRaw = sh.Fecha_Factura || sh.Fecha;
  const fechaOK = parseDate(fechaRaw);
  updates.push({ id, fechaRaw, fechaOK });
}

console.table(updates.map(u => ({ id: u.id, sheet: u.fechaRaw, corregida: u.fechaOK ?? '(null)' })));

if (DRY_RUN) {
  console.log('\n🧪 Nada se actualizó. Corré sin --dry-run para aplicar.');
  process.exit(0);
}

let ok = 0, fail = 0;
for (const u of updates) {
  const { error } = await supabase.from('facturas')
    .update({ fecha_factura: u.fechaOK })
    .eq('id_factura', u.id);
  if (error) { console.error(`  ❌ ${u.id}: ${error.message}`); fail++; }
  else ok++;
}
console.log(`\n✅ ${ok} actualizadas, ❌ ${fail} errores`);
