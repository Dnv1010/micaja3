/**
 * Diagnóstico del Drive folder: estructura + permisos
 */
import { google } from 'googleapis';
import { readFileSync } from 'fs';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const FOLDER_ID = '1UwbMWczp8zDqM5891FY8_AdBA-qmRMgU';

const creds = JSON.parse(readFileSync('./google-credentials.json', 'utf8'));
const auth = new google.auth.JWT({
  email: creds.client_email, key: creds.private_key,
  scopes: ['https://www.googleapis.com/auth/drive.readonly'],
});
await auth.authorize();
const drive = google.drive({ version: 'v3', auth });

console.log(`🔑 SA: ${creds.client_email}\n`);

// 1. ¿Accede a la carpeta raíz?
try {
  const meta = await drive.files.get({
    fileId: FOLDER_ID,
    fields: 'id, name, mimeType, owners, shared, permissions',
    supportsAllDrives: true,
  });
  console.log('📁 Folder info:');
  console.log(`  name: ${meta.data.name}`);
  console.log(`  mimeType: ${meta.data.mimeType}`);
  console.log(`  shared: ${meta.data.shared}`);
} catch (e) {
  console.log(`❌ NO accede a la carpeta: ${e.message}`);
  process.exit(1);
}

// 2. Listar TODO el contenido (folders + archivos) con supportsAllDrives
const res = await drive.files.list({
  q: `'${FOLDER_ID}' in parents and trashed = false`,
  fields: 'files(id, name, mimeType, size)',
  pageSize: 1000,
  supportsAllDrives: true,
  includeItemsFromAllDrives: true,
});

const items = res.data.files ?? [];
const folders = items.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
const files = items.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');

console.log(`\n📂 Subfolders (${folders.length}):`);
folders.slice(0, 20).forEach(f => console.log(`  - ${f.name} (${f.id})`));

console.log(`\n📄 Archivos en raíz (${files.length}):`);
files.slice(0, 10).forEach(f => console.log(`  - ${f.name} (${f.mimeType})`));

// 3. Si hay subfolder "Facturas_Images", contar archivos ahí
const fiFolder = folders.find(f => /factura/i.test(f.name));
if (fiFolder) {
  console.log(`\n🔎 Explorando "${fiFolder.name}"...`);
  let total = 0; let pageToken;
  do {
    const r = await drive.files.list({
      q: `'${fiFolder.id}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType)',
      pageSize: 1000,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    total += (r.data.files ?? []).length;
    if (total <= 5) (r.data.files ?? []).slice(0,5).forEach(f => console.log(`    · ${f.name}`));
    pageToken = r.data.nextPageToken;
  } while (pageToken);
  console.log(`  TOTAL archivos en ${fiFolder.name}: ${total}`);
}
