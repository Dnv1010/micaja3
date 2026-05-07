/**
 * Migración: fotos de transfers legacy → Supabase Storage
 *
 * Contexto:
 *   Los registros legacy tienen voucher_number con paths relativos como:
 *     "Envio_Images/8f5fa279.Comprobante.204510.jpg"
 *   Estos son nombres de archivo en Google Drive (no URLs completas).
 *
 * Estrategia:
 *  1. Consulta transfers con voucher_number que NO empiece con "https://"
 *  2. Extrae el nombre de archivo del path
 *  3. Busca el archivo en Drive (carpeta configurada o búsqueda global)
 *  4. Descarga de Drive → sube a Supabase Storage → actualiza voucher_number
 *
 * Requisitos:
 *  - GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY en .env.local
 *    (o google-credentials.json en la raíz del proyecto)
 *  - SUPABASE_SERVICE_KEY en .env.local
 *  - Opcional: GOOGLE_DRIVE_ENVIOS_FOLDER_ID en .env.local para limitar
 *    la búsqueda a la carpeta de envíos (más rápido)
 *
 * Uso:
 *   node scripts/migrate-transfer-images.mjs            # dry run (sin cambios)
 *   node scripts/migrate-transfer-images.mjs --apply    # aplica cambios
 */

import { createClient }  from '@supabase/supabase-js';
import { google }        from 'googleapis';
import { readFileSync }  from 'fs';
import * as dotenv       from 'dotenv';

dotenv.config({ path: '.env.local' });

// ── Config ───────────────────────────────────────────────────────────────────

const DRY_RUN = !process.argv.includes('--apply');
const BUCKET  = 'micaja-files';
const TABLE   = 'transfers';

// Carpeta de Drive donde están las imágenes de envíos (opcional pero acelera la búsqueda)
const ENVIOS_FOLDER_ID =
  process.env.GOOGLE_DRIVE_ENVIOS_FOLDER_ID ||
  process.env.GOOGLE_DRIVE_FOLDER_ID ||
  null;

// ── Supabase ─────────────────────────────────────────────────────────────────

const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) {
  console.error('❌ Falta SUPABASE_SERVICE_KEY en .env.local');
  process.exit(1);
}

function resolveSupabaseUrl(key) {
  const explicit = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (explicit) return explicit.trim();
  const parts   = key.split('.');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
  if (!payload.ref) throw new Error('JWT sin ref; define NEXT_PUBLIC_SUPABASE_URL');
  return `https://${payload.ref}.supabase.co`;
}

const supabase = createClient(resolveSupabaseUrl(SUPABASE_KEY), SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  db:   { schema: 'micaja' },
});

// ── Google Drive ─────────────────────────────────────────────────────────────

function getDriveClient() {
  const email  = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;

  if (email && rawKey) {
    const key  = rawKey.replace(/\\n/g, '\n');
    const auth = new google.auth.JWT({
      email, key,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
    return google.drive({ version: 'v3', auth });
  }

  try {
    const creds = JSON.parse(readFileSync('./google-credentials.json', 'utf8'));
    const auth  = new google.auth.JWT({
      email:  creds.client_email,
      key:    creds.private_key,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
    return google.drive({ version: 'v3', auth });
  } catch {
    console.error(
      '❌ Sin credenciales Google: define GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY ' +
      'en .env.local, o coloca google-credentials.json en la raíz.'
    );
    process.exit(1);
  }
}

/** Indexa archivos de Drive de forma recursiva. Retorna mapa { filename_lowercase → fileId }. */
async function buildDriveFileMap(drive, folderId, map = {}) {
  let pageToken;
  do {
    const res = await drive.files.list({
      q:                         `'${folderId}' in parents and trashed = false`,
      fields:                    'nextPageToken, files(id, name, mimeType)',
      pageSize:                  1000,
      pageToken,
      supportsAllDrives:         true,
      includeItemsFromAllDrives: true,
    });
    for (const f of res.data.files ?? []) {
      if (f.mimeType === 'application/vnd.google-apps.folder') {
        await buildDriveFileMap(drive, f.id, map);
      } else {
        map[f.name.toLowerCase()] = f.id;
        process.stdout.write(`  Indexando archivos Drive... ${Object.keys(map).length}\r`);
      }
    }
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return map;
}

/** Búsqueda global en Drive por nombre exacto (fallback). */
async function searchDriveByName(drive, filename) {
  try {
    const safe = filename.replace(/'/g, "\\'");
    const res  = await drive.files.list({
      q:                         `name = '${safe}' and trashed = false`,
      fields:                    'files(id, name)',
      pageSize:                  5,
      supportsAllDrives:         true,
      includeItemsFromAllDrives: true,
      corpora:                   'allDrives',
    });
    return (res.data.files ?? [])[0]?.id ?? null;
  } catch {
    return null;
  }
}

/** Descarga un archivo de Drive como Buffer. */
async function downloadDriveFile(drive, fileId) {
  try {
    const res = await drive.files.get(
      { fileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'arraybuffer' }
    );
    return Buffer.from(res.data);
  } catch {
    return null;
  }
}

// ── Tipo de archivo ───────────────────────────────────────────────────────────

function detectExt(buf) {
  if (buf.length < 5) return 'jpg';
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'jpg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45
  ) return 'webp';
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return 'pdf';
  return 'jpg';
}

function extToMime(ext) {
  return (
    { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf' }[ext] ??
    'image/jpeg'
  );
}

// ── Storage ───────────────────────────────────────────────────────────────────

async function uploadToStorage(storagePath, buffer, mimeType) {
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType: mimeType, upsert: false, cacheControl: '3600',
  });
  if (error) {
    if (error.message?.includes('already exists') || error.statusCode === 409) {
      const { error: e2 } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
        contentType: mimeType, upsert: true, cacheControl: '3600',
      });
      if (e2) throw e2;
    } else {
      throw error;
    }
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

function buildStoragePath(row, filename) {
  const sector    = (row.region || 'Bogota').replace(/\s+/g, '_');
  const yearMonth = row.fecha ? row.fecha.slice(0, 7) : new Date().toISOString().slice(0, 7);
  const safeName  = filename.replace(/[^a-zA-Z0-9._\-]/g, '_');
  return `envios/${sector}/${yearMonth}/legacy_${safeName}`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🔄 Migración de fotos de transfers (Drive → Supabase Storage)');
  console.log(`   Modo: ${DRY_RUN ? '🔍 DRY RUN (sin cambios)' : '✏️  APPLY (escribirá en DB)'}`);
  console.log('─'.repeat(60));

  // 1. Cargar transfers con voucher_number que NO sea URL (paths legacy tipo "Envio_Images/…")
  const { data: rows, error: dbErr } = await supabase
    .from(TABLE)
    .select('id, transfer_id, fecha, region, voucher_number')
    .not('voucher_number', 'is', null)
    .not('voucher_number', 'like', 'https://%');

  if (dbErr) {
    console.error('❌ Error DB:', dbErr.message);
    process.exit(1);
  }

  const legacy = rows ?? [];
  console.log(`\n📊 Transfers con imagen legacy (path relativo): ${legacy.length}`);

  if (legacy.length === 0) {
    console.log('✅ No hay registros con paths legacy. Nada que migrar.');
    return;
  }

  // Muestra de los primeros valores para confirmar el formato
  console.log('\nEjemplos de voucher_number encontrados:');
  for (const r of legacy.slice(0, 5)) {
    console.log(`  ${r.transfer_id}  →  "${r.voucher_number}"`);
  }

  // 2. Conectar a Drive e indexar archivos
  console.log('\n🔑 Conectando a Google Drive...');
  const drive = getDriveClient();

  let driveMap = {};
  if (ENVIOS_FOLDER_ID) {
    console.log(`\n📂 Indexando archivos en carpeta ${ENVIOS_FOLDER_ID} (recursivo)...`);
    await buildDriveFileMap(drive, ENVIOS_FOLDER_ID, driveMap);
    console.log(`\n   Total archivos indexados: ${Object.keys(driveMap).length}`);
  } else {
    console.log('\n⚠️  GOOGLE_DRIVE_ENVIOS_FOLDER_ID no definido — se usará búsqueda global por nombre (más lento).');
  }

  // 3. Cruzar con registros DB
  let items = legacy.map(row => {
    const filename = (row.voucher_number ?? '').split('/').pop() ?? '';
    const driveId  = driveMap[filename.toLowerCase()] ?? null;
    return { row, filename, driveId };
  });

  // Fallback: búsqueda global para los que no se encontraron en el mapa
  const sinMatch = items.filter(c => !c.driveId);
  if (sinMatch.length > 0) {
    console.log(`\n🔍 Buscando ${sinMatch.length} archivos en todo Drive...`);
    let found = 0;
    for (let i = 0; i < items.length; i++) {
      if (items[i].driveId) continue;
      process.stdout.write(`   [${i + 1}/${items.length}] buscando ${items[i].filename}...\r`);
      const driveId = await searchDriveByName(drive, items[i].filename);
      if (driveId) { items[i] = { ...items[i], driveId }; found++; }
      await new Promise(r => setTimeout(r, 200));
    }
    console.log(`   Encontrados en búsqueda global: ${found}          `);
  }

  const conMatch = items.filter(c => c.driveId).length;
  console.log(`\n📊 Con archivo en Drive: ${conMatch} / ${items.length}`);

  if (DRY_RUN) {
    console.log('\n📋 Primeros 10 cruces DB ↔ Drive:');
    for (const { row, filename, driveId } of items.slice(0, 10)) {
      const status = driveId ? '✅' : '❌ no encontrado';
      console.log(`  ${row.transfer_id}  →  ${filename}  [${status}]`);
    }
    console.log('\n💡 Para migrar: node scripts/migrate-transfer-images.mjs --apply');
    return;
  }

  // 4. Migrar cada registro
  console.log('\n🚀 Iniciando migración...\n');
  const stats = { ok: 0, sinMatch: 0, errorDrive: 0, errorStorage: 0 };

  for (let i = 0; i < items.length; i++) {
    const { row, filename, driveId } = items[i];
    const prefix = `[${i + 1}/${items.length}] ${row.transfer_id}`;

    if (!driveId) {
      console.log(`${prefix} ⏭️  Sin coincidencia en Drive (${filename})`);
      stats.sinMatch++;
      continue;
    }

    const buffer = await downloadDriveFile(drive, driveId);
    if (!buffer || buffer.length < 50) {
      console.log(`${prefix} ❌ No se pudo descargar (Drive ID: ${driveId})`);
      stats.errorDrive++;
      continue;
    }

    const ext         = detectExt(buffer);
    const mime        = extToMime(ext);
    // Usa el nombre original con ext detectada para trazabilidad
    const storageName = /\.(jpg|jpeg|png|webp|pdf)$/i.test(filename)
      ? filename
      : `${filename}.${ext}`;
    const storagePath = buildStoragePath(row, storageName);

    let publicUrl;
    try {
      publicUrl = await uploadToStorage(storagePath, buffer, mime);
    } catch (e) {
      console.log(`${prefix} ❌ Error Storage: ${e.message}`);
      stats.errorStorage++;
      continue;
    }

    const { error: ue } = await supabase
      .from(TABLE)
      .update({ voucher_number: publicUrl })
      .eq('transfer_id', row.transfer_id);

    if (ue) {
      console.log(`${prefix} ❌ Error DB: ${ue.message}`);
      stats.errorStorage++;
    } else {
      console.log(`${prefix} ✅ → ${publicUrl}`);
      stats.ok++;
    }

    await new Promise(r => setTimeout(r, 300));
  }

  console.log('\n' + '─'.repeat(60));
  console.log('📊 Resultado final:');
  console.log(`   ✅ Migradas con éxito:  ${stats.ok}`);
  console.log(`   ⏭️  Sin archivo Drive:  ${stats.sinMatch}`);
  console.log(`   ❌ Error en Drive:      ${stats.errorDrive}`);
  console.log(`   ❌ Error en Storage:    ${stats.errorStorage}`);
}

main().catch(e => {
  console.error('\n❌ Error inesperado:', e.message);
  process.exit(1);
});
