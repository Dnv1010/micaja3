/**
 * smoke-test-rename.ts
 *
 * Verifica que los nombres de tabla en TABLES apunten correctamente a la DB.
 * Ejecutar ANTES de mergear el PR de Fase 1.
 *
 * Requiere:
 *   - lib/db-tables.ts creado en Fase 1
 *   - Variables SUPABASE_URL y SUPABASE_SERVICE_KEY disponibles
 *
 * Uso:
 *   $env:SUPABASE_URL="..."; $env:SUPABASE_SERVICE_KEY="..."; npx tsx scripts/smoke-test-rename.ts
 *   O con .env.local: npx dotenv -e .env.local -- npx tsx scripts/smoke-test-rename.ts
 */

import { createClient } from "@supabase/supabase-js";
import { TABLES } from "../lib/db-tables";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌  Faltan variables: SUPABASE_URL y/o SUPABASE_SERVICE_KEY");
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

type CheckResult = { table: string; ok: boolean; rowCount: number; error?: string };

async function checkTable(key: keyof typeof TABLES, selectCols = "id"): Promise<CheckResult> {
  const tableName = TABLES[key];
  try {
    const { data, error, count } = await db
      .from(tableName)
      .select(selectCols, { count: "exact", head: false })
      .limit(1);

    if (error) {
      return { table: `${key} → "${tableName}"`, ok: false, rowCount: 0, error: error.message };
    }

    return {
      table: `${key} → "${tableName}"`,
      ok: true,
      rowCount: count ?? (data?.length ?? 0),
    };
  } catch (e) {
    return { table: `${key} → "${tableName}"`, ok: false, rowCount: 0, error: String(e) };
  }
}

async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  SMOKE TEST — DB rename verification              ");
  console.log(`  ${new Date().toISOString()}                      `);
  console.log("═══════════════════════════════════════════════════\n");

  const results = await Promise.all([
    checkTable("users",          "id, email, role, is_active, region, document_number"),
    checkTable("invoices",       "id, invoice_id, invoice_date, invoice_amount, status, region, submitted_at"),
    checkTable("transfers",      "id, transfer_id, amount, region, voucher_number"),
    checkTable("deliveries",     "id, delivery_id, delivery_date, transfer_id, delivered_amount, confirmed"),
    checkTable("expenseReports", "id, report_id, coordinator, region, status, period_start, period_end"),
    checkTable("expenses",       "id, expense_id, amount, status, region, submitted_at"),
    checkTable("expenseGroups",  "id, group_id, group_name, expense_ids, status"),
    checkTable("botSessions",    "id, chat_id, status, data"),
  ]);

  let allOk = true;
  for (const r of results) {
    const icon = r.ok ? "✅" : "❌";
    const rows = r.ok ? `  (${r.rowCount} rows)` : "";
    console.log(`${icon}  ${r.table}${rows}`);
    if (!r.ok) {
      console.log(`     └─ ERROR: ${r.error}`);
      allOk = false;
    }
  }

  console.log("\n───────────────────────────────────────────────────");
  if (allOk) {
    console.log("✅  ALL CHECKS PASSED — seguro mergear el PR de Fase 1");
  } else {
    console.log("❌  CHECKS FAILED — NO mergear hasta resolver los errores");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Error inesperado:", e);
  process.exit(1);
});
