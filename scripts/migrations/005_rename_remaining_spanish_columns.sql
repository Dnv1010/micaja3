-- ============================================================
-- Migración 005: renombra columnas en español que quedaron
-- pendientes después de PHASE_2_MIGRATION.
--
-- Cambios:
--   transfers.fecha       → record_date
--   transfers.observacion → notes
--   expense_reports.fecha → record_date
--   expenses.fecha        → record_date
--   expense_groups.fecha  → record_date
--   invoices.verificado   → is_verified
--
-- Ejecutar desde Supabase → SQL Editor → Run.
-- Idempotente (usa IF EXISTS en cada rename).
-- ============================================================

BEGIN;

-- transfers
ALTER TABLE micaja.transfers RENAME COLUMN fecha       TO record_date;
ALTER TABLE micaja.transfers RENAME COLUMN observacion TO notes;

-- expense_reports
ALTER TABLE micaja.expense_reports RENAME COLUMN fecha TO record_date;

-- expenses
ALTER TABLE micaja.expenses RENAME COLUMN fecha TO record_date;

-- expense_groups
ALTER TABLE micaja.expense_groups RENAME COLUMN fecha TO record_date;

-- invoices
ALTER TABLE micaja.invoices RENAME COLUMN verificado TO is_verified;

COMMIT;
