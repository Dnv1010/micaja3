/**
 * Analiza las 19 filas "nuevas" detectadas para entender duplicados
 * (ayuda a entender la diferencia entre "19 nuevas" del script y "10 reales" del usuario)
 */
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { readFileSync } from 'fs';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const SPREADSHEET_ID = process.env.MICAJA_SPREADSHEET_ID;
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const creds = JSON.parse(readFileSync('./google-credentials.json', 'utf8'));
const auth = new google.auth.JWT({
  email: creds.client_email, key: creds.private_key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
await auth.authorize();
const sheetsApi = google.sheets({ version: 'v4', auth });

const res = await sheetsApi.spreadsheets.values.get({
  spreadsheetId: SPREADSHEET_ID, range: 'Facturas!A:Z',
});
const rows = res.data.values;
const headers = rows[0].map(h => String(h).trim());
const data = rows.slice(1).map(row => {
  const o = {};
  headers.forEach((h, i) => { o[h] = row[i] ?? ''; });
  return o;
});

// IDs existentes en Supabase
const existing = new Set();
let from = 0;
while (true) {
  const { data: d, error } = await supabase.from('facturas').select('id_factura, num_factura, monto_factura, fecha_factura, responsable').range(from, from + 999);
  if (error) throw error;
  if (!d.length) break;
  d.forEach(r => existing.add(r.id_factura));
  if (d.length < 1000) break;
  from += 1000;
}

// Nuevas (id_factura no está en Supabase)
const nuevas = data.filter(r => {
  const id = String(r.ID_Factura || r.ID || '').trim();
  return id && !existing.has(id);
});
console.log(`📊 Filas en sheet: ${data.length}`);
console.log(`📊 IDs en Supabase: ${existing.size}`);
console.log(`✨ Nuevas por id_factura: ${nuevas.length}\n`);

// Mostrar las 19 con detalle
console.log('🔍 Las 19 filas nuevas:');
console.table(nuevas.map((r, i) => ({
  '#': i + 1,
  id_factura: r.ID_Factura || r.ID,
  num_factura: r.Num_Factura,
  fecha: r.Fecha_Factura || r.Fecha,
  monto: r.Monto_Factura,
  responsable: (r.Responsable || '').slice(0, 20),
  legalizado: r.Legalizado,
  adjunto: (r.Adjuntar_Factura || '').slice(0, 40),
})));

// Detectar duplicados entre las nuevas por (num_factura + monto + responsable)
const key = r => `${String(r.Num_Factura||'').trim()}|${String(r.Monto_Factura||'').trim()}|${String(r.Responsable||'').trim()}`;
const groups = {};
nuevas.forEach((r, i) => {
  const k = key(r);
  (groups[k] = groups[k] || []).push({ i: i + 1, id: r.ID_Factura || r.ID });
});
const dups = Object.entries(groups).filter(([_, arr]) => arr.length > 1);
console.log(`\n🔁 Grupos duplicados entre las ${nuevas.length} nuevas (por num_factura+monto+responsable):`);
if (dups.length === 0) console.log('  (ninguno)');
else dups.forEach(([k, arr]) => console.log(`  ${k}  →  filas #${arr.map(a => a.i).join(', ')}  (ids: ${arr.map(a=>a.id).join(', ')})`));

const uniqueCount = Object.keys(groups).length;
console.log(`\n→ Únicos por (num+monto+resp): ${uniqueCount}`);
console.log(`→ Duplicados entre las nuevas: ${nuevas.length - uniqueCount}`);

// Además: ¿alguna nueva coincide con una EXISTENTE por num_factura + monto + fecha?
console.log('\n🔍 Chequeo extra: ¿alguna de las nuevas ya existe en Supabase con OTRO id_factura?');
const supExist = [];
from = 0;
while (true) {
  const { data: d } = await supabase.from('facturas').select('id_factura, num_factura, monto_factura, fecha_factura, responsable').range(from, from + 999);
  if (!d?.length) break;
  supExist.push(...d);
  if (d.length < 1000) break;
  from += 1000;
}
const supKey = r => `${String(r.num_factura||'').trim()}|${Number(r.monto_factura||0).toFixed(2)}|${String(r.responsable||'').trim()}`;
const supSet = new Set(supExist.map(supKey));
const parseMonto = v => { if (!v) return 0; const c=String(v).replace(/\$|\s/g,'').replace(/\./g,'').replace(',','.'); const n=parseFloat(c); return isNaN(n)?0:n; };
const nuevasKey = r => `${String(r.Num_Factura||'').trim()}|${parseMonto(r.Monto_Factura||0).toFixed(2)}|${String(r.Responsable||'').trim()}`;
const yaExistenPorContenido = nuevas.filter(r => supSet.has(nuevasKey(r)));
console.log(`  ${yaExistenPorContenido.length} de las ${nuevas.length} coinciden con algo ya en Supabase (diferente id, mismo contenido)`);
yaExistenPorContenido.forEach(r => console.log(`    id=${r.ID_Factura||r.ID}  num=${r.Num_Factura}  monto=${r.Monto_Factura}  resp=${r.Responsable}`));
