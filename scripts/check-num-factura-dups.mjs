/**
 * Busca duplicados más laxos: por num_factura solo (ignorando responsable/monto)
 */
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { readFileSync } from 'fs';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

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
const data = rows.slice(1).map(row => {
  const o = {};
  headers.forEach((h, i) => { o[h] = row[i] ?? ''; });
  return o;
});

const existing = new Set();
let from = 0;
while (true) {
  const { data: d } = await supabase.from('facturas').select('id_factura').range(from, from + 999);
  if (!d?.length) break;
  d.forEach(r => existing.add(r.id_factura));
  if (d.length < 1000) break;
  from += 1000;
}

const nuevas = data.filter(r => {
  const id = String(r.ID_Factura || r.ID || '').trim();
  return id && !existing.has(id);
});

// ¿Existe en Supabase algún num_factura igual a los de las nuevas?
const nums = nuevas.map(r => String(r.Num_Factura || '').trim()).filter(Boolean);
console.log(`Buscando ${nums.length} num_factura en Supabase...\n`);
const { data: matches } = await supabase
  .from('facturas')
  .select('id_factura, num_factura, monto_factura, fecha_factura, responsable')
  .in('num_factura', nums);

console.log(`Coincidencias de num_factura ya en Supabase: ${(matches||[]).length}`);
console.table(matches || []);

// Map para mostrar qué num_factura de las nuevas ya existen
const supNums = new Set((matches||[]).map(m => String(m.num_factura||'').trim()));
const dupEnSup = nuevas.filter(r => supNums.has(String(r.Num_Factura||'').trim()));
const realmenteNuevas = nuevas.filter(r => !supNums.has(String(r.Num_Factura||'').trim()));

console.log(`\n📊 Resumen:`);
console.log(`  Total nuevas por id_factura: ${nuevas.length}`);
console.log(`  De esas, con num_factura ya en Supabase: ${dupEnSup.length}`);
console.log(`  Realmente nuevas (num_factura único): ${realmenteNuevas.length}`);

if (dupEnSup.length) {
  console.log(`\n🔁 Las que ya existen en Supabase por num_factura (posibles duplicados):`);
  console.table(dupEnSup.map(r => ({
    id_factura: r.ID_Factura || r.ID,
    num_factura: r.Num_Factura,
    responsable: (r.Responsable||'').slice(0,25),
    monto: r.Monto_Factura,
  })));
}

console.log(`\n✨ Las ${realmenteNuevas.length} únicas (por num_factura):`);
console.table(realmenteNuevas.map((r,i) => ({
  '#': i+1,
  id_factura: r.ID_Factura || r.ID,
  num_factura: r.Num_Factura,
  monto: r.Monto_Factura,
  fecha: r.Fecha_Factura,
  responsable: (r.Responsable||'').slice(0,25),
  legalizado: r.Legalizado,
})));
