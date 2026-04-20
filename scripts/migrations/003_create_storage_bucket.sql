-- ============================================================
-- Migración 003: bucket público "micaja-files" para PDFs e imágenes.
--
-- Estructura de rutas dentro del bucket:
--   facturas/{sector}/{YYYY-MM}/{archivo}
--   reportes/{sector}/{archivo}
--   gastos/{sector}/{YYYY-MM}/{archivo}
--
-- Ejecutar desde Supabase → SQL Editor → Run.
-- Idempotente.
-- ============================================================

-- Bucket público (lectura directa por URL pública de Storage).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'micaja-files',
  'micaja-files',
  true,
  10485760, -- 10 MB
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Policy: cualquiera puede LEER (bucket público). Evitamos duplicar si ya existe.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'micaja-files read public'
  ) THEN
    CREATE POLICY "micaja-files read public"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'micaja-files');
  END IF;
END$$;

-- Policy: solo el service_role puede escribir/borrar (los uploads pasan por la API).
-- El service_role ya salta RLS, así que esto es defensa en profundidad.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'micaja-files write service only'
  ) THEN
    CREATE POLICY "micaja-files write service only"
      ON storage.objects FOR ALL
      USING (bucket_id = 'micaja-files' AND auth.role() = 'service_role')
      WITH CHECK (bucket_id = 'micaja-files' AND auth.role() = 'service_role');
  END IF;
END$$;
