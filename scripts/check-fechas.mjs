/**
 * Chequea fechas de las 19 insertadas: compara Sheet vs Supabase
 */
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { readFileSync } from 'fs';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const NEW_IDS = [
  '5458e5d2','a3bcacb3','814a3253','0f3d0c27','7590c078','bf9c01d1','83ea6bdf',
  '0bf6b706','65d95cef','2e1b6ba5','1c819c4a','29f9d07a','4eca5003','d12e1e93',
  'def328e2','6976308f','05635b54','3bb93f68','f763ffb1'
];

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const creds = JSON.parse(readFileSync('./google-credentials.json', 'utf8'));
const auth = new google.auth.JWT({
  email: creds.client_email, key: creds.private_key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
await auth.authorize();
const sheetsApi = google.sheets({ version: 'v4', auth });

// Leer sheet
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

// Leer Supabase
const { data: supa } = await supabase
  .from('facturas')
  .select('id_factura, num_factura, fecha_factura, monto_factura, estado, url')
  .in('id_factura', NEW_IDS);
const supById = new Map(supa.map(r => [r.id_factura, r]));

// Comparar
console.log('═'.repeat(100));
console.log('COMPARACIÓN fecha_factura: Sheet vs Supabase (19 insertadas)');
console.log('═'.repeat(100));
console.table(NEW_IDS.map(id => {
  const sh = sheetById.get(id);
  const su = supById.get(id);
  return {
    id_factura: id,
    num_factura: sh?.Num_Factura || '',
    fecha_sheet: sh?.Fecha_Factura || sh?.Fecha || '(vacío)',
    fecha_supabase: su?.fecha_factura || '(null)',
    en_supabase: su ? '✓' : '✗',
    estado: su?.estado || '',
    tiene_url: su?.url ? '✓' : '✗',
  };
}));

// Resumen de nulls en fecha
const conNull = Object.values(supById).length === 0 ? [] : supa.filter(r => !r.fecha_factura);
console.log(`\nFilas con fecha_factura NULL en Supabase: ${conNull.length}`);
conNull.forEach(r => console.log(`  ${r.id_factura} | num=${r.num_factura}`));
