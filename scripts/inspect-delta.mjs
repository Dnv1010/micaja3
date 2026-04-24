/**
 * Pre-flight inspection: muestra formato de datos actuales + acceso a Drive
 * Uso: node scripts/inspect-delta.mjs
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function main() {
  console.log('═'.repeat(60));
  console.log('🔎 INSPECCIÓN PRE-SYNC');
  console.log('═'.repeat(60));

  // 1. Cuenta actual + muestra formato
  const { count } = await supabase
    .from('facturas')
    .select('*', { count: 'exact', head: true });
  console.log(`\n📊 Facturas en Supabase: ${count}`);

  const { data: sample } = await supabase
    .from('facturas')
    .select('id_factura, num_factura, fecha_factura, adjuntar_factura, url, estado, sector')
    .order('created_at', { ascending: false })
    .limit(5);
  console.log('\n🔹 Últimas 5 facturas:');
  console.table(sample);

  // 2. Distribución de estados (para validar mapping Legalizado → estado)
  const { data: estados } = await supabase
    .from('facturas')
    .select('estado');
  const dist = estados.reduce((acc, r) => { acc[r.estado] = (acc[r.estado] || 0) + 1; return acc; }, {});
  console.log('\n📊 Distribución de estados:');
  console.table(dist);

  // 3. Storage bucket
  const { data: buckets } = await supabase.storage.listBuckets();
  console.log('\n🪣 Buckets:');
  console.table(buckets.map(b => ({ name: b.name, public: b.public })));

  const { data: filesInBucket } = await supabase.storage
    .from('micaja-files')
    .list('facturas', { limit: 5 });
  console.log('\n📁 Primeros subdirs en micaja-files/facturas:');
  console.log(filesInBucket);
}
main().catch(e => { console.error('❌', e.message); process.exit(1); });
