/**
 * Chequea la carpeta vieja del .env para ver si los archivos nuevos están ahí
 */
import { google } from 'googleapis';
import { readFileSync } from 'fs';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

const creds = JSON.parse(readFileSync('./google-credentials.json', 'utf8'));
const auth = new google.auth.JWT({
  email: creds.client_email, key: creds.private_key,
  scopes: ['https://www.googleapis.com/auth/drive.readonly'],
});
await auth.authorize();
const drive = google.drive({ version: 'v3', auth });

console.log(`🔑 SA: ${creds.client_email}`);
console.log(`📁 Folder env: ${FOLDER_ID}\n`);

try {
  const meta = await drive.files.get({ fileId: FOLDER_ID, fields: 'name, mimeType' });
  console.log(`✓ Accede: "${meta.data.name}"\n`);
} catch (e) {
  console.log(`❌ No accede: ${e.message}`);
  process.exit(1);
}

// Listar contenido
const res = await drive.files.list({
  q: `'${FOLDER_ID}' in parents and trashed = false`,
  fields: 'files(id, name, mimeType)', pageSize: 1000,
});
const folders = (res.data.files||[]).filter(f => f.mimeType === 'application/vnd.google-apps.folder');
const files = (res.data.files||[]).filter(f => f.mimeType !== 'application/vnd.google-apps.folder');
console.log(`📂 ${folders.length} subfolders, 📄 ${files.length} archivos en raíz`);
folders.slice(0,10).forEach(f => console.log(`  subfolder: ${f.name}`));
files.slice(0,5).forEach(f => console.log(`  archivo: ${f.name}`));

// Buscar por nombre uno de los sin-match del dry-run
const needle = '5458e5d2.Adjuntar_Factura.132847.jpg';
console.log(`\n🔎 Buscando "${needle}" en toda Drive accesible...`);
const hit = await drive.files.list({
  q: `name = '${needle}' and trashed = false`,
  fields: 'files(id, name, parents, mimeType)',
});
console.log(`  ${(hit.data.files||[]).length} coincidencias:`);
(hit.data.files||[]).forEach(f => console.log(`  ✓ ${f.name}  parents=${f.parents}`));

// Búsqueda por sufijo común
console.log(`\n🔎 Archivos *Adjuntar_Factura*.jpg en Drive accesible (primeros 10):`);
const broad = await drive.files.list({
  q: `name contains 'Adjuntar_Factura' and trashed = false`,
  fields: 'files(id, name, parents)', pageSize: 10,
});
(broad.data.files||[]).forEach(f => console.log(`  · ${f.name}  parents=${f.parents}`));
