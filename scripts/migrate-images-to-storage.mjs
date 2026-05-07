/**
 * Migración: imágenes legacy (Facturas_Images/...) → Supabase Storage
 *
 * Estrategia:
 *  1. Consulta todos los `invoices` con attachment_url sin "https://"
 *  2. Extrae el nombre de archivo del path  (ej. "abc123.Adjuntar_Factura.161900.png")
 *  3. Lista los archivos en la carpeta Drive "Facturas_Images" y construye
 *     un mapa  filename → Drive file ID
 *  4. Para cada factura: descarga de Drive → sube a Supabase Storage → actualiza DB
 *
 * Uso:
 *   node scripts/migrate-images-to-storage.mjs            # dry run
 *   node scripts/migrate-images-to-storage.mjs --apply    # aplica cambios
 *
 * Requisitos:
 *   - google-credentials.json (service account con acceso a Drive)
 *   - SUPABASE_SERVICE_KEY en .env.local
 *   - GOOGLE_DRIVE_FOLDER_ID en .env.local  (carpeta raíz de Drive que
 *     contiene la subcarpeta "Facturas_Images")
 *     → si no está en env, usa el valor hardcoded abajo como fallback
 */

import { createClient }  from '@supabase/supabase-js';
import { google }        from 'googleapis';
import { readFileSync }  from 'fs';
import * as dotenv       from 'dotenv';

dotenv.config({ path: '.env.local' });

// ── Config ───────────────────────────────────────────────────────────────────

const DRY_RUN = !process.argv.includes('--apply');
const BUCKET  = 'micaja-files';
const TABLE   = 'invoices';

// Carpeta raíz en Drive (la que contiene "Facturas_Images").
const ROOT_FOLDER_ID =
  process.env.GOOGLE_DRIVE_FOLDER_ID ||
  process.env.GOOGLE_DRIVE_FACTURAS_FOLDER_ID ||
  '1UwbMWczp8zDqM5891FY8_AdBA-qmRMgU';

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
  // Primero intenta con variables de entorno (disponibles en .env.local)
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;

  if (email && rawKey) {
    // En .env los \n vienen como literal "\\n" — los convertimos a saltos reales
    const key = rawKey.replace(/\\n/g, '\n');
    const auth = new google.auth.JWT({
      email,
      key,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
    return google.drive({ version: 'v3', auth });
  }

  // Fallback: archivo JSON
  try {
    const creds = JSON.parse(readFileSync('./google-credentials.json', 'utf8'));
    const auth  = new google.auth.JWT({
      email:  creds.client_email,
      key:    creds.private_key,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
    return google.drive({ version: 'v3', auth });
  } catch (e) {
    console.error('❌ Sin credenciales Google: define GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY en .env.local, o coloca google-credentials.json en la raíz.');
    process.exit(1);
  }
}

/**
 * Indexa archivos de Drive de forma recursiva (incluye todas las subcarpetas).
 * Retorna un mapa  { filename_lowercase → fileId }.
 */
async function buildDriveFileMapRecursive(drive, folderId, map = {}, folderName = '') {
  let pageToken;
  do {
    const res = await drive.files.list({
      q:                        `'${folderId}' in parents and trashed = false`,
      fields:                   'nextPageToken, files(id, name, mimeType)',
      pageSize:                 1000,
      pageToken,
      supportsAllDrives:        true,
      includeItemsFromAllDrives: true,
    });
    for (const f of res.data.files ?? []) {
      if (f.mimeType === 'application/vnd.google-apps.folder') {
        await buildDriveFileMapRecursive(drive, f.id, map, f.name);
      } else {
        map[f.name.toLowerCase()] = f.id;
        process.stdout.write(`  Indexando archivos Drive... ${Object.keys(map).length}\r`);
      }
    }
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return map;
}

/**
 * Busca un archivo en todo Drive por nombre exacto (fallback cuando no está en carpetas conocidas).
 * Retorna el file ID o null.
 */
async function searchDriveByName(drive, filename) {
  try {
    const safe = filename.replace(/'/g, "\\'");
    const res = await drive.files.list({
      q:                        `name = '${safe}' and trashed = false`,
      fields:                   'files(id, name)',
      pageSize:                 5,
      supportsAllDrives:        true,
      includeItemsFromAllDrives: true,
      corpora:                  'allDrives',
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
  } catch (e) {
    return null;
  }
}

// ── Detección de tipo ─────────────────────────────────────────────────────────

function detectExt(buf) {
  if (buf.length < 5) return 'jpg';
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'jpg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45) return 'webp';
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return 'pdf';
  return 'jpg';
}

function extToMime(ext) {
  return { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf' }[ext] ?? 'image/jpeg';
}

// ── Storage ───────────────────────────────────────────────────────────────────

async function uploadToStorage(path, buffer, mimeType) {
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: mimeType, upsert: false, cacheControl: '3600',
  });
  if (error) {
    if (error.message?.includes('already exists') || error.statusCode === 409) {
      const { error: e2 } = await supabase.storage.from(BUCKET).upload(path, buffer, {
        contentType: mimeType, upsert: true, cacheControl: '3600',
      });
      if (e2) throw e2;
    } else {
      throw error;
    }
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function buildStoragePath(row, filename) {
  const sector     = (row.region || 'Bogota').replace(/\s+/g, '_');
  const yearMonth  = row.invoice_date ? row.invoice_date.slice(0, 7) : new Date().toISOString().slice(0, 7);
  // Usa el nombre original de archivo para mantener trazabilidad
  const safeName   = filename.replace(/[^a-zA-Z0-9._\-]/g, '_');
  return `facturas/${sector}/${yearMonth}/legacy_${safeName}`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔄 Migración de imágenes legacy → Supabase Storage`);
  console.log(`   Modo: ${DRY_RUN ? '🔍 DRY RUN (sin cambios)' : '✏️  APPLY (escribirá en DB)'}`);
  console.log('─'.repeat(60));

  // 1. Cargar registros legacy de la DB
  const { data: rows1, error: e1 } = await supabase
    .from(TABLE)
    .select('id, invoice_id, attachment_url, url, drive_file_id, assignee, region, invoice_date')
    .not('attachment_url', 'is', null)
    .not('attachment_url', 'like', 'https://%');

  if (e1) { console.error('❌ Error DB:', e1.message); process.exit(1); }

  const { data: rows2 } = await supabase
    .from(TABLE)
    .select('id, invoice_id, attachment_url, url, drive_file_id, assignee, region, invoice_date')
    .is('attachment_url', null)
    .not('url', 'is', null)
    .not('url', 'like', 'https://%');

  const legacy = [...(rows1 ?? []), ...(rows2 ?? [])];
  console.log(`\n📊 Registros con imagen legacy: ${legacy.length}`);
  if (legacy.length === 0) {
    console.log('✅ No hay registros legacy. Nada que migrar.');
    return;
  }

  // 2. Conectar a Drive e indexar archivos de forma recursiva
  console.log('\n🔑 Conectando a Google Drive...');
  const drive = getDriveClient();

  const FOLDER_IDS_TO_SEARCH = [
    ROOT_FOLDER_ID,
    '1UwbMWczp8zDqM5891FY8_AdBA-qmRMgU',
  ].filter((v, i, a) => a.indexOf(v) === i); // dedup

  // 3. Construir mapa filename → Drive file ID (búsqueda recursiva en todas las subcarpetas)
  console.log('\n📂 Indexando archivos en Drive (búsqueda recursiva)...');
  const driveMap = {};
  for (const fid of FOLDER_IDS_TO_SEARCH) {
    console.log(`   📁 Explorando carpeta: ${fid}`);
    try {
      await buildDriveFileMapRecursive(drive, fid, driveMap);
    } catch (e) {
      console.log(`   ⚠️  Sin acceso a ${fid}: ${e.message}`);
    }
  }
  console.log(`\n   Total archivos indexados: ${Object.keys(driveMap).length}`);

  // 4. Cruzar con registros DB (carpetas conocidas primero)
  let cruzados = legacy.map(row => {
    const rawPath = row.attachment_url || row.url || '';
    const filename = rawPath.split('/').pop() || '';
    const driveId  = driveMap[filename.toLowerCase()] ?? null;
    return { row, filename, driveId };
  });

  // 4b. Fallback: búsqueda global en Drive para los sin coincidencia
  const sinMatchInicial = cruzados.filter(c => !c.driveId);
  if (sinMatchInicial.length > 0) {
    console.log(`\n🔍 Buscando ${sinMatchInicial.length} archivos en todo Drive (búsqueda global)...`);
    let found = 0;
    for (let i = 0; i < cruzados.length; i++) {
      if (cruzados[i].driveId) continue;
      const { filename } = cruzados[i];
      process.stdout.write(`   [${i + 1}/${cruzados.length}] buscando ${filename}...\r`);
      const driveId = await searchDriveByName(drive, filename);
      if (driveId) {
        cruzados[i] = { ...cruzados[i], driveId };
        found++;
      }
      // Pequeña pausa para no saturar la API
      await new Promise(r => setTimeout(r, 200));
    }
    console.log(`   Archivos encontrados en búsqueda global: ${found}          `);
  }

  const conMatch = cruzados.filter(c => c.driveId).length;
  const sinMatch = cruzados.length - conMatch;

  console.log(`\n📊 Cruce DB ↔ Drive:`);
  console.log(`   Con archivo en Drive: ${conMatch}`);
  console.log(`   Sin coincidencia:     ${sinMatch}`);

  if (DRY_RUN) {
    console.log('\n📋 Primeros 10 registros:');
    for (const { row, filename, driveId } of cruzados.slice(0, 10)) {
      console.log(`  • ${row.invoice_id}  →  ${filename}`);
      console.log(`      Drive ID: ${driveId ?? '❌ no encontrado en Drive'}`);
    }
    console.log('\n💡 Para migrar: node scripts/migrate-images-to-storage.mjs --apply');
    return;
  }

  // 5. Migración efectiva
  console.log('\n🚀 Iniciando migración...\n');
  const stats = { ok: 0, sinMatch: 0, errorDrive: 0, errorStorage: 0 };

  for (let i = 0; i < cruzados.length; i++) {
    const { row, filename, driveId } = cruzados[i];
    const prefix = `[${i + 1}/${cruzados.length}] ${row.invoice_id}`;

    if (!driveId) {
      console.log(`${prefix} ⏭️  Sin coincidencia en Drive (${filename})`);
      stats.sinMatch++;
      continue;
    }

    // Descargar de Drive
    const buffer = await downloadDriveFile(drive, driveId);
    if (!buffer || buffer.length < 50) {
      console.log(`${prefix} ❌ No se pudo descargar (Drive ID: ${driveId})`);
      stats.errorDrive++;
      continue;
    }

    // Subir a Storage
    const ext  = detectExt(buffer);
    const mime = extToMime(ext);
    // Si el filename ya tiene ext, la usamos tal cual; si no, agregamos la detectada
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

    // Actualizar DB
    const { error: ue } = await supabase
      .from(TABLE)
      .update({
        attachment_url: publicUrl,
        url:            publicUrl,
        updated_at:     new Date().toISOString(),
      })
      .eq('invoice_id', row.invoice_id);

    if (ue) {
      console.log(`${prefix} ❌ Error DB: ${ue.message}`);
      stats.errorStorage++;
    } else {
      console.log(`${prefix} ✅ → ${publicUrl}`);
      stats.ok++;
    }

    // Pausa para respetar rate limits
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
