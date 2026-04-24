/**
 * Sync incremental: Sheet Facturas → Supabase (solo nuevas) + archivos Drive → Storage
 *
 * Uso:
 *   node scripts/sync-delta-facturas.mjs --dry-run    # solo reporta, no toca nada
 *   node scripts/sync-delta-facturas.mjs              # ejecuta de verdad
 *   node scripts/sync-delta-facturas.mjs --verbose    # extra logs
 */
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { readFileSync } from 'fs';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SPREADSHEET_ID = process.env.MICAJA_SPREADSHEET_ID;
const DRIVE_FOLDER_ID = '1UwbMWczp8zDqM5891FY8_AdBA-qmRMgU';
const BUCKET = 'micaja-files';

if (!SUPABASE_SERVICE_KEY) { console.error('❌ Falta SUPABASE_SERVICE_KEY'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ─── Google auth ────────────────────────────────────────────────
function getAuth() {
  const creds = JSON.parse(readFileSync('./google-credentials.json', 'utf8'));
  return new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets.readonly',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
  });
}

// ─── Helpers de parseo ──────────────────────────────────────────
const parseDate = v => {
  if (!v) return null;
  const s = String(v).trim();
  // DD/MM/YYYY o DD-MM-YYYY (formato colombiano)
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    const d = parseInt(dd, 10), mo = parseInt(mm, 10);
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) {
      return `${yyyy}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    }
  }
  // YYYY-MM-DD directo
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // fallback Date()
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
};
const parseMonto = v => {
  if (!v) return 0;
  const c = String(v).replace(/\$/g,'').replace(/\s/g,'').replace(/\./g,'').replace(',','.');
  const n = parseFloat(c);
  return isNaN(n) ? 0 : n;
};
const parseBool = v => ['TRUE','SI','SÍ','YES','1','VERDADERO'].includes(String(v).trim().toUpperCase());
const normalizeSector = v => {
  const s = String(v||'').trim().toLowerCase();
  return (s.includes('costa')||s.includes('caribe')||s.includes('barranquilla')||s.includes('cartagena')) ? 'Costa Caribe' : 'Bogota';
};
const normalizeEstado = v => {
  const s = String(v||'').trim().toLowerCase();
  if (s === 'aprobada' || s === 'aprobado') return 'Aprobada';
  if (s === 'completada' || s === 'completado') return 'Completada';
  if (s === 'rechazada' || s === 'rechazado') return 'Rechazada';
  return 'Pendiente';
};

// ─── Lectura Sheet ──────────────────────────────────────────────
async function readSheet(sheets, range) {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
  const rows = res.data.values ?? [];
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => String(h).trim());
  return rows.slice(1).map(row => {
    const o = {};
    headers.forEach((h, i) => { o[h] = row[i] ?? ''; });
    return o;
  });
}

// ─── Drive: indexar archivos ────────────────────────────────────
async function indexDriveFolder(drive) {
  const files = new Map();    // exact name → {id, mimeType, name}
  const filesLower = new Map(); // lowercase name → same
  let pageToken;
  do {
    const res = await drive.files.list({
      q: `'${DRIVE_FOLDER_ID}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, size)',
      pageSize: 1000,
      pageToken,
    });
    for (const f of res.data.files ?? []) {
      files.set(f.name, f);
      filesLower.set(f.name.toLowerCase(), f);
    }
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return { files, filesLower };
}

function findInDrive({ files, filesLower }, adjunto) {
  if (!adjunto) return null;
  // adjunto puede ser: nombre limpio, URL, path con slashes
  const name = adjunto.split('/').pop();
  if (files.has(name)) return files.get(name);
  if (filesLower.has(name.toLowerCase())) return filesLower.get(name.toLowerCase());
  // probar sin extensión: algunos tienen ".Adjuntar_Factura.XXX.jpg" dentro del nombre
  return null;
}

async function downloadDriveFile(drive, fileId) {
  const res = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  );
  return Buffer.from(res.data);
}

// ─── Map de fila de Sheet a registro Supabase ───────────────────
function rowToFactura(r) {
  return {
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
    sector: r.Sector ? normalizeSector(r.Sector) : 'Bogota',
    centro_costo: String(r['Centro de Costo'] || '').trim() || null,
    fecha_creacion: new Date().toISOString(),
  };
}

function storagePath(f) {
  const sector = f.sector || 'Bogota';
  const yyyymm = (f.fecha_creacion || new Date().toISOString()).slice(0, 7);
  // usamos el nombre original del archivo en Drive para trazabilidad
  return `facturas/${sector}/${yyyymm}/${f.id_factura}__${f._driveFileName}`;
}

// ─── Main ───────────────────────────────────────────────────────
async function main() {
  console.log('═'.repeat(60));
  console.log(DRY_RUN ? '🧪 DRY-RUN — no se inserta/sube nada' : '🚀 SYNC REAL');
  console.log('═'.repeat(60));

  const auth = getAuth();
  await auth.authorize();
  const sheetsApi = google.sheets({ version: 'v4', auth });
  const driveApi = google.drive({ version: 'v3', auth });

  // 1. Leer Sheet
  console.log('\n📥 Leyendo Sheet Facturas...');
  const sheetRows = await readSheet(sheetsApi, 'Facturas!A:Z');
  console.log(`  ${sheetRows.length} filas en sheet`);

  // 2. Obtener IDs existentes en Supabase
  console.log('🔍 Leyendo IDs existentes en Supabase...');
  const existingIds = new Set();
  let from = 0, chunk = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('facturas')
      .select('id_factura')
      .range(from, from + chunk - 1);
    if (error) throw error;
    if (!data.length) break;
    data.forEach(r => r.id_factura && existingIds.add(r.id_factura));
    if (data.length < chunk) break;
    from += chunk;
  }
  console.log(`  ${existingIds.size} IDs ya en Supabase`);

  // 3. Filtrar nuevas
  const newRows = sheetRows.filter(r => {
    const id = String(r.ID_Factura || r.ID || '').trim();
    return id && !existingIds.has(id);
  });
  console.log(`\n✨ ${newRows.length} facturas NUEVAS detectadas\n`);

  if (newRows.length === 0) {
    console.log('👌 Nada que hacer. Salida limpia.');
    return;
  }

  // 4. Indexar carpeta Drive
  console.log(`📁 Indexando Drive folder ${DRIVE_FOLDER_ID}...`);
  const driveIndex = await indexDriveFolder(driveApi);
  console.log(`  ${driveIndex.files.size} archivos en la carpeta`);

  // 5. Mapear + match archivos
  let matched = 0, noMatch = 0, noAdjunto = 0;
  const mapped = newRows.map(r => rowToFactura(r));
  const missingList = [];
  for (let i = 0; i < mapped.length; i++) {
    const f = mapped[i];
    const adj = f.adjuntar_factura;
    if (!adj) { noAdjunto++; continue; }
    if (/^https?:\/\//i.test(adj)) {
      // ya es URL (probablemente Supabase o Drive viejo) → dejar tal cual, sin re-subir
      f.url = f.url || adj;
      continue;
    }
    const hit = findInDrive(driveIndex, adj);
    if (hit) {
      matched++;
      f._driveFileId = hit.id;
      f._driveFileName = hit.name;
      f._driveMime = hit.mimeType;
    } else {
      noMatch++;
      missingList.push({ id_factura: f.id_factura, adjuntar: adj });
    }
  }
  console.log(`\n📸 Archivos de Drive:`);
  console.log(`  ✓ match: ${matched}`);
  console.log(`  ⚠ sin match: ${noMatch}`);
  console.log(`  — sin adjunto: ${noAdjunto}`);

  if (noMatch > 0 && (VERBOSE || DRY_RUN)) {
    console.log('\n⚠️  Primeros 10 sin match:');
    console.table(missingList.slice(0, 10));
  }

  // Preview de primeras filas mapeadas
  console.log('\n🔹 Muestra de las 5 primeras nuevas:');
  console.table(mapped.slice(0, 5).map(f => ({
    id_factura: f.id_factura,
    num_factura: f.num_factura,
    fecha_factura: f.fecha_factura,
    monto: f.monto_factura,
    estado: f.estado,
    sector: f.sector,
    archivo_drive: f._driveFileName || (f.url ? 'URL directa' : '—'),
  })));

  if (DRY_RUN) {
    console.log('\n🧪 DRY-RUN terminado. Nada fue modificado.');
    console.log('   Corré sin --dry-run para ejecutar de verdad.');
    return;
  }

  // 6. Subir archivos a Storage
  console.log('\n⬆️  Subiendo archivos a Storage...');
  let uploaded = 0, uploadFail = 0;
  for (const f of mapped) {
    if (!f._driveFileId) continue;
    try {
      const buf = await downloadDriveFile(driveApi, f._driveFileId);
      const path = storagePath(f);
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, buf, { contentType: f._driveMime || 'application/octet-stream', upsert: true });
      if (error) throw error;
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      f.url = pub.publicUrl;
      f.adjuntar_factura = pub.publicUrl;
      uploaded++;
      if (uploaded % 10 === 0) process.stdout.write(`\r  ${uploaded}/${matched}`);
    } catch (e) {
      uploadFail++;
      console.error(`\n  ❌ Upload ${f.id_factura}: ${e.message}`);
    }
  }
  console.log(`\n  ✅ ${uploaded} subidos, ${uploadFail} fallidos`);

  // 7. Limpiar campos temporales antes de insertar
  for (const f of mapped) {
    delete f._driveFileId;
    delete f._driveFileName;
    delete f._driveMime;
  }

  // 8. Insert en Supabase
  console.log('\n💾 Insertando en Supabase...');
  let ins = 0, insErr = 0;
  for (let i = 0; i < mapped.length; i += 100) {
    const batch = mapped.slice(i, i + 100);
    const { error } = await supabase
      .from('facturas')
      .upsert(batch, { onConflict: 'id_factura' });
    if (error) { console.error(`  ❌ Lote ${i}:`, error.message); insErr += batch.length; }
    else ins += batch.length;
  }
  console.log(`  ✅ ${ins} insertadas, ${insErr} con error`);

  console.log('\n' + '═'.repeat(60));
  console.log('✅ SYNC COMPLETADO');
  console.log('═'.repeat(60));
}

main().catch(e => { console.error('\n❌ Error fatal:', e); process.exit(1); });
