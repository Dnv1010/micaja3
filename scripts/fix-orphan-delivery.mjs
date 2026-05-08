/**
 * fix-orphan-delivery.mjs
 *
 * Crea el transfer faltante para la delivery huérfana 7d61073c
 * y la vincula actualizando su transfer_id.
 *
 * Uso (dry-run por defecto):
 *   node scripts/fix-orphan-delivery.mjs
 *
 * Para aplicar:
 *   node scripts/fix-orphan-delivery.mjs --apply
 */

import { readFileSync, existsSync } from "fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  for (const p of [".env.local", ".env"]) {
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const clean = line.trim();
      if (!clean || clean.startsWith("#")) continue;
      const eq = clean.indexOf("=");
      if (eq === -1) continue;
      const key = clean.slice(0, eq).trim();
      const val = clean.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌  Faltan variables de entorno");
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
  db: { schema: "micaja" },
});

const applyMode = process.argv.includes("--apply");

async function main() {
  console.log(`\n🔧  Fix orphan delivery 7d61073c  [${applyMode ? "APPLY" : "DRY-RUN"}]\n`);

  // 1. Leer la delivery completa
  const { data: deliveries, error: fetchErr } = await db
    .from("deliveries")
    .select("*")
    .eq("delivery_id", "7d61073c")
    .limit(1);

  if (fetchErr) { console.error("❌  Error leyendo delivery:", fetchErr.message); process.exit(1); }
  if (!deliveries?.length) { console.error("❌  Delivery 7d61073c no encontrada"); process.exit(1); }

  const d = deliveries[0];
  console.log("📋  Delivery encontrada:");
  console.log(JSON.stringify(d, null, 2));

  // 2. Construir el transfer a crear
  const newTransferId = `ENV-${d.delivery_id}`;
  const transfer = {
    transfer_id:    newTransferId,
    fecha:          d.delivery_date ?? d.fecha ?? d.created_at?.slice(0, 10),
    assignee:       d.assignee ?? d.responsable,
    amount:         d.delivered_amount ?? d.monto_entregado,
    region:         d.region ?? d.sector ?? "Costa Caribe",
    voucher_number: d.comprobante ?? null,
    observacion:    "Generado desde delivery huérfana 7d61073c",
  };

  console.log("\n📝  Transfer a crear:");
  console.log(JSON.stringify(transfer, null, 2));

  if (!applyMode) {
    console.log("\n⚠️   Modo DRY-RUN — no se escribió nada.");
    console.log("     Ejecuta con --apply para aplicar:\n");
    console.log("     node scripts/fix-orphan-delivery.mjs --apply\n");
    return;
  }

  // 3. Insertar el transfer
  const { error: insertErr } = await db.from("transfers").insert(transfer);
  if (insertErr) { console.error("❌  Error creando transfer:", insertErr.message); process.exit(1); }
  console.log("\n✅  Transfer creado:", newTransferId);

  // 4. Vincular la delivery al nuevo transfer
  const { error: updateErr } = await db
    .from("deliveries")
    .update({ transfer_id: newTransferId })
    .eq("delivery_id", "7d61073c");

  if (updateErr) { console.error("❌  Error vinculando delivery:", updateErr.message); process.exit(1); }
  console.log("✅  Delivery 7d61073c vinculada a", newTransferId);
  console.log("\n🎉  Listo. Ejecuta validate-drop-deliveries.mjs para confirmar.\n");
}

main().catch((e) => { console.error("Error inesperado:", e); process.exit(1); });
