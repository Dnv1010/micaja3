/**
 * validate-drop-deliveries.mjs
 *
 * Valida que sea seguro ejecutar DROP TABLE deliveries en producción.
 *
 * Uso (no requiere instalar nada extra):
 *   node scripts/validate-drop-deliveries.mjs
 */

import { readFileSync, existsSync } from "fs";
import { createClient } from "@supabase/supabase-js";

// Lee .env.local automáticamente
function loadEnv() {
  const paths = [".env.local", ".env"];
  for (const p of paths) {
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

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error(
    "❌  Faltan variables: SUPABASE_URL (o NEXT_PUBLIC_SUPABASE_URL) y SUPABASE_SERVICE_KEY (o SUPABASE_SERVICE_ROLE_KEY)"
  );
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
  db: { schema: "micaja" },
});

async function fetchAll(table, cols) {
  const PAGE = 1000;
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from(table).select(cols).range(from, from + PAGE - 1);
    if (error) throw new Error(`Error leyendo ${table}: ${error.message}`);
    const batch = data ?? [];
    out.push(...batch);
    if (batch.length < PAGE) break;
  }
  return out;
}

async function main() {
  console.log("\n🔍  Validando datos antes de DROP TABLE deliveries...\n");

  let transfers, deliveries;
  try {
    [transfers, deliveries] = await Promise.all([
      fetchAll("transfers", "transfer_id, assignee, amount, fecha"),
      fetchAll("deliveries", "delivery_id, transfer_id, assignee, delivered_amount"),
    ]);
  } catch (e) {
    console.error("❌  Error al consultar la base de datos:", e.message);
    console.error("    Verifica que las variables SUPABASE_URL y SUPABASE_SERVICE_KEY sean correctas.");
    process.exit(1);
  }

  console.log(`📊  transfers:  ${transfers.length} filas`);
  console.log(`📊  deliveries: ${deliveries.length} filas\n`);

  const transferMap = new Map(transfers.map((t) => [t.transfer_id, t]));

  // 1. Deliveries huérfanas
  const huerfanas = deliveries.filter((d) => d.transfer_id && !transferMap.has(d.transfer_id));
  const sinTransferId = deliveries.filter((d) => !d.transfer_id);

  if (huerfanas.length === 0) {
    console.log("✅  Sin deliveries huérfanas");
  } else {
    console.log(`❌  ${huerfanas.length} delivery/ies huérfana/s (transfer_id no existe en transfers):`);
    for (const d of huerfanas) {
      console.log(`     - delivery_id=${d.delivery_id}  transfer_id=${d.transfer_id}  assignee=${d.assignee}`);
    }
  }

  if (sinTransferId.length > 0) {
    console.log(`⚠️   ${sinTransferId.length} delivery/ies con transfer_id NULL:`);
    for (const d of sinTransferId) {
      console.log(`     - delivery_id=${d.delivery_id}  assignee=${d.assignee}  amount=${d.delivered_amount}`);
    }
  } else {
    console.log("✅  Ninguna delivery con transfer_id NULL");
  }

  // 2. Diferencias de monto
  const diferencias = [];
  for (const d of deliveries) {
    if (!d.transfer_id) continue;
    const t = transferMap.get(d.transfer_id);
    if (!t) continue;
    if (Number(t.amount) !== Number(d.delivered_amount)) {
      diferencias.push({ transfer_id: d.transfer_id, amountTransfer: t.amount, amountDelivery: d.delivered_amount });
    }
  }

  if (diferencias.length === 0) {
    console.log("✅  Todos los montos coinciden (transfers.amount = deliveries.delivered_amount)");
  } else {
    console.log(`⚠️   ${diferencias.length} fila/s con monto diferente:`);
    for (const d of diferencias) {
      console.log(`     - transfer_id=${d.transfer_id}  transfers.amount=${d.amountTransfer}  deliveries.delivered_amount=${d.amountDelivery}`);
    }
  }

  // 3. Transfers sin delivery (informativo)
  const transferIdsConDelivery = new Set(deliveries.map((d) => d.transfer_id).filter(Boolean));
  const transfersSinDelivery = transfers.filter((t) => !transferIdsConDelivery.has(t.transfer_id));

  if (transfersSinDelivery.length === 0) {
    console.log("✅  Todos los transfers tienen una delivery asociada");
  } else {
    console.log(`ℹ️   ${transfersSinDelivery.length} transfer/s sin delivery (informativo):`);
    for (const t of transfersSinDelivery.slice(0, 10)) {
      console.log(`     - transfer_id=${t.transfer_id}  assignee=${t.assignee}  fecha=${t.fecha}`);
    }
    if (transfersSinDelivery.length > 10) console.log(`     ... y ${transfersSinDelivery.length - 10} más`);
  }

  // Veredicto
  const bloqueantes = huerfanas.length + sinTransferId.length;
  console.log("\n" + "─".repeat(60));
  if (bloqueantes === 0) {
    console.log("🟢  VEREDICTO: SEGURO ejecutar DROP TABLE deliveries;\n");
    console.log("   SQL a ejecutar en Supabase → SQL Editor:\n");
    console.log("   DROP TABLE public.deliveries;");
    if (diferencias.length > 0) {
      console.log(`\n   ⚠️  Hay ${diferencias.length} diferencia/s de monto. Revísalas antes.`);
    }
  } else {
    console.log("🔴  VEREDICTO: NO SEGURO — resuelve los problemas antes de hacer DROP");
  }
  console.log("─".repeat(60) + "\n");
}

main().catch((e) => {
  console.error("Error inesperado:", e);
  process.exit(1);
});
