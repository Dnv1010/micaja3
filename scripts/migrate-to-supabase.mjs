/**
 * MICAJA - Script de migración Google Sheets → Supabase
 * Ejecutar con: node scripts/migrate-to-supabase.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = 'https://cjxfibdtlhbazobthywm.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SPREADSHEET_ID = '1sVDPDsDRL9MiiTrzp6YID7k9h9ZaayE50WAEyodZF1k';
const SCHEMA = 'micaja';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { db: { schema: 'public' } });

import { readFileSync } from "fs";
async function getSheetsClient() {
  const creds = JSON.parse(readFileSync("./google-credentials.json", "utf8"));
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return google.sheets({ version: "v4", auth });
}

async function getSheetData(sheets, range) {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
  const rows = res.data.values ?? [];
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => String(h).trim());
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] ?? ''; });
    return obj;
  });
}

function parseDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
}

// ✅ FUNCIÓN CORREGIDA: soporta formato colombiano $10.000,00
function parseMonto(val) {
  if (!val) return 0;
  const cleaned = String(val)
    .replace(/\$/g, '')      // quita el signo $
    .replace(/\s/g, '')      // quita espacios
    .replace(/\./g, '')      // quita puntos de miles
    .replace(',', '.');      // convierte coma decimal a punto
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function parseBool(val) {
  const v = String(val).trim().toUpperCase();
  return ['TRUE','SI','SÍ','YES','1','VERDADERO'].includes(v);
}
function normalizeSector(val) {
  const v = String(val).trim().toLowerCase();
  return (v.includes('costa') || v.includes('caribe') || v.includes('barranquilla') || v.includes('cartagena')) ? 'Costa Caribe' : 'Bogota';
}
function normalizeEstado(val) {
  const v = String(val).trim().toLowerCase();
  if (v === 'aprobada' || v === 'aprobado') return 'Aprobada';
  if (v === 'completada' || v === 'completado') return 'Completada';
  if (v === 'rechazada' || v === 'rechazado') return 'Rechazada';
  return 'Pendiente';
}
function normalizeRol(val) {
  const v = String(val).trim().toLowerCase();
  if (v === 'admin') return 'admin';
  if (v === 'coordinador') return 'coordinador';
  return 'user';
}

async function insertBatch(table, rows, batchSize = 100) {
  let inserted = 0, errors = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).upsert(batch);
    if (error) { console.error(`  ❌ Lote ${i}:`, error.message); errors += batch.length; }
    else { inserted += batch.length; process.stdout.write(`  ✓ ${inserted}/${rows.length}\r`); }
  }
  console.log(`  ✅ ${inserted} insertados, ${errors} errores`);
}

async function main() {
  console.log('🚀 Migración MiCaja: Google Sheets → Supabase');
  console.log('━'.repeat(50));
  if (!SUPABASE_SERVICE_KEY) { console.error('❌ Falta SUPABASE_SERVICE_KEY en .env.local'); process.exit(1); }

  const sheets = await getSheetsClient();
  const inicio = Date.now();

  // USUARIOS
  console.log('\n📋 Usuarios...');
  const usuarios = (await getSheetData(sheets, 'Usuarios!A:Z'))
    .filter(r => r.Correos || r.Correo)
    .map(r => ({
      responsable: String(r.Responsable || '').trim(),
      correo: String(r.Correos || r.Correo || '').trim().toLowerCase(),
      telefono: String(r.Telefono || '').replace(/[^0-9]/g, '') || null,
      rol: normalizeRol(r.Rol || 'user'),
      user_active: parseBool(r.UserActive ?? 'TRUE'),
      area: String(r.Area || '').trim() || null,
      cargo: String(r.Cargo || '').trim() || null,
      cedula: String(r.Cedula || '').trim() || null,
      pin: String(r.PIN || r.Pin || '1234').trim() || '1234',
      sector: normalizeSector(r.Sector || 'Bogota'),
      telegram_chat_id: String(r.TelegramChatId || '').trim() || null,
    })).filter(r => r.correo);
  await insertBatch('usuarios', usuarios);

  // ENVIOS
  console.log('\n📋 Envios...');
  const envios = (await getSheetData(sheets, 'Envio!A:F'))
    .filter(r => r.IDEnvio || r.ID)
    .map(r => ({
      id_envio: String(r.IDEnvio || r.ID || '').trim(),
      fecha: parseDate(r.Fecha) ?? new Date().toISOString().split('T')[0],
      responsable: String(r.Responsable || '').trim(),
      monto: parseMonto(r.Monto || 0),
      sector: r.Sector ? normalizeSector(r.Sector) : null,
      comprobante: String(r.Comprobante || '').trim() || null,
    })).filter(r => r.id_envio);
  await insertBatch('envios', envios);

  // ENTREGAS
  console.log('\n📋 Entregas...');
  const entregas = (await getSheetData(sheets, 'Entregas!A:H'))
    .filter(r => r.ID_Entrega || r.ID)
    .map(r => ({
      id_entrega: String(r.ID_Entrega || r.ID || '').trim(),
      fecha_entrega: parseDate(r.Fecha_Entrega || r.Fecha) ?? new Date().toISOString().split('T')[0],
      id_envio: String(r.ID_Envio || r.IDEnvio || '').trim() || null,
      responsable: String(r.Responsable || '').trim(),
      monto_entregado: parseMonto(r.Monto_Entregado || 0),
      saldo_total_entregado: parseMonto(r.Saldo_Total_Entregado || 0),
      aceptar: parseBool(r.Aceptar ?? 'FALSE'),
      firma: String(r.Firma || '').trim() || null,
    })).filter(r => r.id_entrega);
  await insertBatch('entregas', entregas);

  // FACTURAS
  console.log('\n📋 Facturas...');
  const facturas = (await getSheetData(sheets, 'Facturas!A:Z'))
    .filter(r => r.ID_Factura || r.ID)
    .map(r => ({
      id_factura: String(r.ID_Factura || r.ID || '').trim(),
      num_factura: String(r.Num_Factura || '').trim() || null,
      fecha_factura: parseDate(r.Fecha_Factura || r.Fecha),
      monto_factura: parseMonto(r.Monto_Factura || 0),
      responsable: String(r.Responsable || '').trim(),
      tipo_servicio: String(r.Tipo_servicio || '').trim() || null,
      tipo_factura: String(r.Tipo_Factura || '').trim() || null,
      nit_factura: String(r.Nit_Factura || '').trim() || null,
      razon_social: String(r.Razon_Social || '').trim() || null,
      nombre_bia: parseBool(r.Nombre_bia ?? 'FALSE'),
      observacion: String(r.Observacion || '').trim() || null,
      adjuntar_factura: String(r.Adjuntar_Factura || '').trim() || null,
      url: String(r.URL || '').trim() || null,
      estado: normalizeEstado(r.Legalizado || r.Estado || 'Pendiente'),
      verificado: parseBool(r.Verificado ?? 'FALSE'),
      ciudad: String(r.Ciudad || '').trim() || null,
      sector: r.Sector ? normalizeSector(r.Sector) : null,
      centro_costo: String(r['Centro de Costo'] || '').trim() || null,
      fecha_creacion: new Date().toISOString(),
    })).filter(r => r.id_factura);
  await insertBatch('facturas', facturas);

  // LEGALIZACIONES
  console.log('\n📋 Legalizaciones...');
  const legalizaciones = (await getSheetData(sheets, 'Legalizaciones!A:Z'))
    .filter(r => r.ID_Reporte || r.ID)
    .map(r => ({
      id_reporte: String(r.ID_Reporte || r.ID || '').trim(),
      fecha: parseDate(r.Fecha) ?? new Date().toISOString().split('T')[0],
      coordinador: String(r.Coordinador || r.Responsable || '').trim(),
      sector: r.Sector ? normalizeSector(r.Sector) : null,
      total: parseMonto(r.Total || 0),
      total_aprobado: parseMonto(r.TotalAprobado || r.Total_Aprobado || 0),
      estado: String(r.Estado || 'Pendiente').trim(),
      observacion: String(r.Observacion || '').trim() || null,
      url_reporte: String(r.URL || '').trim() || null,
    })).filter(r => r.id_reporte);
  await insertBatch('legalizaciones', legalizaciones);

  // GASTOS GENERALES
  console.log('\n📋 Gastos Generales...');
  const gastosGen = (await getSheetData(sheets, 'Gastos_Generales!A:Z'))
    .filter(r => r.ID || r.ID_Gasto)
    .map(r => ({
      id_gasto: String(r.ID_Gasto || r.ID || '').trim(),
      fecha: parseDate(r.Fecha) ?? new Date().toISOString().split('T')[0],
      descripcion: String(r.Descripcion || '').trim() || null,
      monto: parseMonto(r.Monto || 0),
      categoria: String(r.Categoria || '').trim() || null,
      responsable: String(r.Responsable || '').trim() || null,
      sector: r.Sector ? normalizeSector(r.Sector) : null,
      comprobante: String(r.Comprobante || '').trim() || null,
      estado: String(r.Estado || 'Pendiente').trim(),
    })).filter(r => r.id_gasto);
  await insertBatch('gastos_generales', gastosGen);

  // GASTOS GRUPOS
  console.log('\n📋 Gastos Grupos...');
  const gastosGrupos = (await getSheetData(sheets, 'Gastos_Grupos!A:Z'))
    .filter(r => r.ID || r.ID_Gasto)
    .map(r => ({
      id_gasto: String(r.ID_Gasto || r.ID || '').trim(),
      fecha: parseDate(r.Fecha) ?? new Date().toISOString().split('T')[0],
      grupo: String(r.Grupo || '').trim() || null,
      descripcion: String(r.Descripcion || '').trim() || null,
      monto: parseMonto(r.Monto || 0),
      responsable: String(r.Responsable || '').trim() || null,
      sector: r.Sector ? normalizeSector(r.Sector) : null,
      estado: String(r.Estado || 'Pendiente').trim(),
    })).filter(r => r.id_gasto);
  await insertBatch('gastos_grupos', gastosGrupos);

  console.log('\n' + '━'.repeat(50));
  console.log(`✅ Migración completada en ${((Date.now() - inicio)/1000).toFixed(1)}s`);
}

main().catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
