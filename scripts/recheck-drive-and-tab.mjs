/**
 * Re-chequeo: acceso a Drive + qué pestaña es gid=420531600
 */
import { google } from 'googleapis';
import { readFileSync } from 'fs';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const FOLDER_ID = '1UwbMWczp8zDqM5891FY8_AdBA-qmRMgU';
const SPREADSHEET_ID = process.env.MICAJA_SPREADSHEET_ID;
const TARGET_GID = 420531600;

const creds = JSON.parse(readFileSync('./google-credentials.json', 'utf8'));
const auth = new google.auth.JWT({
  email: creds.client_email, key: creds.private_key,
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets.readonly',
    'https://www.googleapis.com/auth/drive.readonly',
  ],
});
await auth.authorize();
const drive = google.drive({ version: 'v3', auth });
const sheets = google.sheets({ version: 'v4', auth });

// 1. Acceso Drive
console.log('═'.repeat(50));
console.log('1️⃣  Acceso al Drive folder');
console.log('═'.repeat(50));
try {
  const meta = await drive.files.get({ fileId: FOLDER_ID, fields: 'name, mimeType' });
  console.log(`✅ Accede: "${meta.data.name}"`);
  // contar raíz
  const res = await drive.files.list({
    q: `'${FOLDER_ID}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType)', pageSize: 1000,
  });
  const items = res.data.files || [];
  const folders = items.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
  const files = items.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');
  console.log(`   📂 ${folders.length} subfolders | 📄 ${files.length} archivos en raíz`);
  folders.slice(0,10).forEach(f => console.log(`      sub: ${f.name}`));
  files.slice(0,5).forEach(f => console.log(`      file: ${f.name}`));
} catch (e) {
  console.log(`❌ ${e.message}`);
  process.exit(1);
}

// 2. Pestañas del spreadsheet
console.log('\n' + '═'.repeat(50));
console.log('2️⃣  Pestañas del spreadsheet');
console.log('═'.repeat(50));
const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
const tabs = meta.data.sheets.map(s => ({
  title: s.properties.title,
  sheetId: s.properties.sheetId,
  rows: s.properties.gridProperties?.rowCount,
}));
console.table(tabs);
const target = tabs.find(t => t.sheetId === TARGET_GID);
console.log(`🎯 gid=${TARGET_GID} → pestaña: "${target?.title || 'NO ENCONTRADA'}"`);
