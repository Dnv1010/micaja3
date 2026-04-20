-- ============================================================
-- Migración: agregar columnas faltantes para compatibilidad
-- con la UI existente (feature parity con Google Sheets).
--
-- Todas las columnas se crean nullable para no romper las filas
-- que ya existen. Los valores los irá poblando el código al
-- escribir nuevas filas; las existentes quedan con NULL hasta
-- que se editen.
--
-- Ejecutar desde Supabase → SQL Editor → Run.
-- Seguro de correr múltiples veces (IF NOT EXISTS).
-- ============================================================

-- ---------- facturas ----------
ALTER TABLE public.facturas
  ADD COLUMN IF NOT EXISTS ops              text,
  ADD COLUMN IF NOT EXISTS motivo_rechazo   text,
  ADD COLUMN IF NOT EXISTS drive_file_id    text,
  ADD COLUMN IF NOT EXISTS entrega_id       text;

-- ---------- gastos_generales ----------
-- La tabla actual: id_gasto, fecha, descripcion, monto, categoria,
-- responsable, sector, comprobante, estado. Agregamos los campos
-- que la UI usa (Ciudad, Motivo, FechaInicio/Fin, Concepto, NIT,
-- FechaFactura, CentroCostos, Cargo, FechaCreacion).
ALTER TABLE public.gastos_generales
  ADD COLUMN IF NOT EXISTS cargo           text,
  ADD COLUMN IF NOT EXISTS ciudad          text,
  ADD COLUMN IF NOT EXISTS motivo          text,
  ADD COLUMN IF NOT EXISTS fecha_inicio    date,
  ADD COLUMN IF NOT EXISTS fecha_fin       date,
  ADD COLUMN IF NOT EXISTS concepto        text,
  ADD COLUMN IF NOT EXISTS centro_costos   text,
  ADD COLUMN IF NOT EXISTS nit             text,
  ADD COLUMN IF NOT EXISTS fecha_factura   date,
  ADD COLUMN IF NOT EXISTS fecha_creacion  timestamp with time zone DEFAULT now();

-- ---------- gastos_grupos ----------
-- La tabla actual: id_gasto, fecha, grupo, descripcion, monto,
-- responsable, sector, estado. Agregamos los campos que la UI
-- de agrupaciones usa (PDF firmado, firma coordinador, lista de
-- gastos asociados, cargo/motivo, rango de fechas, centro costos).
ALTER TABLE public.gastos_grupos
  ADD COLUMN IF NOT EXISTS cargo           text,
  ADD COLUMN IF NOT EXISTS motivo          text,
  ADD COLUMN IF NOT EXISTS fecha_inicio    date,
  ADD COLUMN IF NOT EXISTS fecha_fin       date,
  ADD COLUMN IF NOT EXISTS gastos_ids      text,
  ADD COLUMN IF NOT EXISTS pdf_url         text,
  ADD COLUMN IF NOT EXISTS firma           text,
  ADD COLUMN IF NOT EXISTS centro_costos   text,
  ADD COLUMN IF NOT EXISTS fecha_creacion  timestamp with time zone DEFAULT now();

-- ---------- índices útiles ----------
CREATE INDEX IF NOT EXISTS facturas_id_factura_idx       ON public.facturas (id_factura);
CREATE INDEX IF NOT EXISTS facturas_responsable_idx      ON public.facturas (responsable);
CREATE INDEX IF NOT EXISTS facturas_estado_idx           ON public.facturas (estado);
CREATE INDEX IF NOT EXISTS facturas_entrega_id_idx       ON public.facturas (entrega_id);
CREATE INDEX IF NOT EXISTS usuarios_correo_idx           ON public.usuarios (lower(correo));
CREATE INDEX IF NOT EXISTS entregas_id_envio_idx         ON public.entregas (id_envio);
CREATE INDEX IF NOT EXISTS envios_id_envio_idx           ON public.envios (id_envio);
CREATE INDEX IF NOT EXISTS gastos_generales_id_idx       ON public.gastos_generales (id_gasto);
CREATE INDEX IF NOT EXISTS gastos_grupos_id_idx          ON public.gastos_grupos (id_gasto);
CREATE INDEX IF NOT EXISTS sesiones_bot_chat_id_idx      ON public.sesiones_bot (chat_id);
