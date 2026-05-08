-- ============================================================
-- Migración 004: elimina columnas sin uso identificadas en audit.
--
-- Columnas eliminadas:
--   expenses.description      — nunca se popula ni se muestra en UI
--   expenses.category         — sobró de diseño anterior, sin UI
--   expense_groups.group_name — cero referencias en código
--   expense_groups.description — cero referencias en código
--
-- Ejecutar desde Supabase → SQL Editor → Run.
-- Idempotente (usa IF EXISTS).
-- ============================================================

ALTER TABLE micaja.expenses
  DROP COLUMN IF EXISTS description,
  DROP COLUMN IF EXISTS category;

ALTER TABLE micaja.expense_groups
  DROP COLUMN IF EXISTS group_name,
  DROP COLUMN IF EXISTS description;
