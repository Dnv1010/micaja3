-- ============================================================
-- Migración 002: columnas faltantes en legalizaciones
--
-- La UI de reportes necesita persistir periodo, lista de facturas
-- incluidas, firmas del coordinador/admin y resumen IA — campos
-- que la tabla actual no tiene.
--
-- Ejecutar desde Supabase → SQL Editor → Run.
-- Idempotente (IF NOT EXISTS).
-- ============================================================

ALTER TABLE public.legalizaciones
  ADD COLUMN IF NOT EXISTS periodo_desde     date,
  ADD COLUMN IF NOT EXISTS periodo_hasta     date,
  ADD COLUMN IF NOT EXISTS facturas_ids      text,         -- JSON array como string
  ADD COLUMN IF NOT EXISTS firma_coordinador text,         -- data URL base64
  ADD COLUMN IF NOT EXISTS firma_admin       text,         -- data URL base64
  ADD COLUMN IF NOT EXISTS resumen_ia        text,
  ADD COLUMN IF NOT EXISTS fecha_creacion    timestamp with time zone DEFAULT now();

CREATE INDEX IF NOT EXISTS legalizaciones_id_reporte_idx
  ON public.legalizaciones (id_reporte);

CREATE INDEX IF NOT EXISTS legalizaciones_coordinador_idx
  ON public.legalizaciones (coordinador);
