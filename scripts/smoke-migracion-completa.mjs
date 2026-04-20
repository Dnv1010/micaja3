/**
 * Verifica que la migración a Supabase esté completa:
 *   1. Tablas con columnas nuevas
 *   2. Bucket micaja-files existe y es público
 *   3. Upload de prueba → URL pública accesible
 *   4. Cleanup (borrar el archivo de prueba)
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  fs
    .readFileSync(path.resolve(".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;
const payload = JSON.parse(Buffer.from(key.split(".")[1], "base64").toString());
const url = env.NEXT_PUBLIC_SUPABASE_URL || `https://${payload.ref}.supabase.co`;

const sb = createClient(url, key, { auth: { persistSession: false } });

let ok = 0;
let fail = 0;
const pass = (msg) => {
  ok++;
  console.log(`  ✓ ${msg}`);
};
const fail_ = (msg, detail = "") => {
  fail++;
  console.log(`  ✗ ${msg}${detail ? ` — ${detail}` : ""}`);
};

// ── 1. Tablas + columnas ─────────────────────────────────────────
console.log("\n[1/4] Verificando columnas de tablas...");
async function checkColumns(table, cols) {
  const { data, error } = await sb.from(table).select(cols.join(", ")).limit(1);
  if (error) {
    fail_(`${table}: ${cols.length} columnas`, error.message);
    return;
  }
  pass(`${table}: ${cols.length} columnas presentes`);
}

await checkColumns("facturas", [
  "id",
  "id_factura",
  "ops",
  "motivo_rechazo",
  "drive_file_id",
  "entrega_id",
]);
await checkColumns("gastos_generales", [
  "id",
  "id_gasto",
  "cargo",
  "ciudad",
  "motivo",
  "fecha_inicio",
  "fecha_fin",
  "concepto",
  "centro_costos",
  "nit",
  "fecha_factura",
  "fecha_creacion",
]);
await checkColumns("gastos_grupos", [
  "id",
  "id_gasto",
  "cargo",
  "motivo",
  "fecha_inicio",
  "fecha_fin",
  "gastos_ids",
  "pdf_url",
  "firma",
  "centro_costos",
  "fecha_creacion",
]);
await checkColumns("legalizaciones", [
  "id",
  "id_reporte",
  "periodo_desde",
  "periodo_hasta",
  "facturas_ids",
  "firma_coordinador",
  "firma_admin",
  "resumen_ia",
  "fecha_creacion",
]);

// ── 2. Bucket ─────────────────────────────────────────────────────
console.log("\n[2/4] Verificando bucket micaja-files...");
const { data: buckets, error: bErr } = await sb.storage.listBuckets();
if (bErr) {
  fail_("listBuckets falló", bErr.message);
} else {
  const b = buckets.find((x) => x.name === "micaja-files");
  if (!b) {
    fail_("Bucket micaja-files no existe");
  } else {
    pass(`Bucket existe (public=${b.public}, size_limit=${b.file_size_limit})`);
    if (!b.public) fail_("Bucket NO es público (debería serlo)");
  }
}

// ── 3. Upload de prueba ──────────────────────────────────────────
console.log("\n[3/4] Upload de prueba a Storage...");
// 1x1 px PNG transparente
const pngBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAeIVWUUAAAAASUVORK5CYII=",
  "base64"
);
const testPath = `_smoke/test_${Date.now()}.png`;
const up = await sb.storage
  .from("micaja-files")
  .upload(testPath, pngBytes, { contentType: "image/png", upsert: true });
if (up.error) {
  fail_("Upload", up.error.message);
} else {
  pass(`Upload OK: ${up.data.path}`);

  // URL pública
  const { data: pub } = sb.storage.from("micaja-files").getPublicUrl(testPath);
  console.log(`     → URL pública: ${pub.publicUrl}`);

  // Verificar acceso público (sin auth)
  const r = await fetch(pub.publicUrl);
  if (r.ok) {
    pass(`URL pública accesible (HTTP ${r.status}, ${r.headers.get("content-type")})`);
  } else {
    fail_("URL pública NO accesible", `HTTP ${r.status}`);
  }

  // Cleanup
  const del = await sb.storage.from("micaja-files").remove([testPath]);
  if (del.error) fail_("Cleanup del archivo de prueba", del.error.message);
  else pass("Cleanup: archivo de prueba borrado");
}

// ── 4. Conteo de filas (sanity) ──────────────────────────────────
console.log("\n[4/4] Conteo de filas...");
for (const t of [
  "facturas",
  "usuarios",
  "entregas",
  "envios",
  "legalizaciones",
  "gastos_generales",
  "gastos_grupos",
  "sesiones_bot",
]) {
  const r = await fetch(
    `${url}/rest/v1/${t}?select=id`,
    { headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: "count=exact", Range: "0-0" } }
  );
  const total = (r.headers.get("content-range") || "?/?").split("/").pop();
  console.log(`  ${t.padEnd(20)} ${total} filas`);
}

// ── Resumen ─────────────────────────────────────────────────────
console.log("\n" + "═".repeat(50));
if (fail === 0) {
  console.log(`✅ TODO OK — ${ok} checks pasados. Listo para npm run dev.`);
  process.exit(0);
} else {
  console.log(`❌ ${fail} check(s) fallaron, ${ok} pasaron. Revisa arriba.`);
  process.exit(1);
}
