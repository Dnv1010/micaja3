/**
 * Limpia los registros de `invoices` que tienen rutas legacy irrecuperables
 * (Facturas_Images/... o Facturas/...) en attachment_url y url, poniéndolas en null.
 *
 * Estas rutas ya son ignoradas por facturaImageUrlForDisplay() (drive-image-url.ts:64),
 * por lo que la UI ya muestra "sin imagen" — limpiarlas evita confusión y que el script
 * de migración las marque como "pendientes" indefinidamente.
 *
 * Uso:
 *   node scripts/clean-legacy-paths.mjs            # dry run (muestra qué se limpiaría)
 *   node scripts/clean-legacy-paths.mjs --apply    # aplica cambios
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const DRY_RUN = !process.argv.includes('--apply');
const TABLE   = 'invoices';

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

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🧹 Limpieza de rutas legacy irrecuperables en invoices`);
  console.log(`   Modo: ${DRY_RUN ? '🔍 DRY RUN (sin cambios)' : '✏️  APPLY (escribirá en DB)'}`);
  console.log('─'.repeat(60));

  // Registros con attachment_url no-null que no son URLs reales (sin https://)
  const { data: byAttachment, error: e1 } = await supabase
    .from(TABLE)
    .select('id, invoice_id, attachment_url, drive_file_id')
    .not('attachment_url', 'is', null)
    .not('attachment_url', 'like', 'https://%');

  if (e1) { console.error('❌ Error DB:', e1.message); process.exit(1); }

  const rows = byAttachment ?? [];

  console.log(`\n📊 Registros con ruta legacy irrecuperable: ${rows.length}`);
  if (rows.length === 0) {
    console.log('✅ No hay registros para limpiar.');
    return;
  }

  // Separar los que tienen drive_file_id como fallback
  const conDriveId = rows.filter(r => r.drive_file_id?.trim());
  const sinDriveId = rows.filter(r => !r.drive_file_id?.trim());

  console.log(`   Con drive_file_id (imagen aún visible vía Drive): ${conDriveId.length}`);
  console.log(`   Sin drive_file_id (quedarán sin imagen):          ${sinDriveId.length}`);

  if (DRY_RUN) {
    console.log('\n📋 Primeros 15 registros a limpiar:');
    for (const r of rows.slice(0, 15)) {
      const legacyPath = r.attachment_url;
      const fallback   = r.drive_file_id ? `✅ tiene drive_file_id` : `⚠️  sin fallback`;
      console.log(`  • ${r.invoice_id}  ${fallback}`);
      console.log(`      ruta: ${legacyPath}`);
    }
    console.log(`\n💡 Para limpiar: node scripts/clean-legacy-paths.mjs --apply`);
    return;
  }

  // Aplicar limpieza en lotes de 50
  console.log('\n🚀 Limpiando registros...\n');
  let ok = 0;
  let err = 0;
  const BATCH = 50;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const ids   = batch.map(r => r.id);

    const { error: ue } = await supabase
      .from(TABLE)
      .update({ attachment_url: null, updated_at: new Date().toISOString() })
      .in('id', ids);

    if (ue) {
      console.log(`  ❌ Error en lote ${i}-${i + batch.length}: ${ue.message}`);
      err += batch.length;
    } else {
      ok += batch.length;
      console.log(`  ✅ Lote ${i + 1}-${i + batch.length} limpiado (${ok} total)`);
    }
  }

  console.log('\n' + '─'.repeat(60));
  console.log('📊 Resultado:');
  console.log(`   ✅ Registros limpiados: ${ok}`);
  console.log(`   ❌ Errores:             ${err}`);
  if (conDriveId.length > 0) {
    console.log(`\n   ℹ️  ${conDriveId.length} registros aún tienen drive_file_id — imagen accesible vía Drive.`);
  }
}

main().catch(e => {
  console.error('\n❌ Error inesperado:', e.message);
  process.exit(1);
});
