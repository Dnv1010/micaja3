-- =============================================================================
-- PHASE_2_MIGRATION.sql
-- Renombrado físico de tablas y columnas: español → inglés
-- =============================================================================
--
-- PRECONDITIONS (verificar antes de ejecutar):
--   [ ] Backup automático de Supabase reciente confirmado (Dashboard → Backups)
--   [ ] Deploy de Fase 1 en producción y smoke test PASSED
--   [ ] Vercel deployments pausados o en modo mantenimiento
--   [ ] No hay usuarios activos (idealmente ejecutar en madrugada)
--   [ ] Telegram webhook pausado si es posible (comentar TELEGRAM_BOT_TOKEN en env)
--
-- CÓMO EJECUTAR:
--   Supabase Dashboard → SQL Editor → pegar este script → Run
--   Si algo falla: el script es transaccional → ejecutar ROLLBACK; y nada cambia
--
-- POST-EXECUTION CHECKLIST:
--   [ ] Verificar tablas: SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1;
--   [ ] Smoke test: npx tsx scripts/smoke-test-rename.ts (con vars de prod)
--   [ ] Actualizar TABLES en lib/db-tables.ts a nombres nuevos en inglés
--   [ ] Actualizar strings de columnas en código TypeScript
--   [ ] Deploy final a Vercel
--   [ ] Verificar app en producción (facturas, envíos, balance, bot)
-- =============================================================================

BEGIN;

-- ============================================================
-- BLOQUE 1: Renombrar tablas
-- ============================================================

ALTER TABLE usuarios         RENAME TO users;
ALTER TABLE facturas         RENAME TO invoices;
ALTER TABLE envios           RENAME TO transfers;
ALTER TABLE entregas         RENAME TO deliveries;
ALTER TABLE legalizaciones   RENAME TO expense_reports;
ALTER TABLE gastos_generales RENAME TO expenses;
ALTER TABLE gastos_grupos    RENAME TO expense_groups;
ALTER TABLE sesiones_bot     RENAME TO bot_sessions;


-- ============================================================
-- BLOQUE 2: Renombrar columnas — users (era: usuarios)
-- ============================================================

ALTER TABLE users RENAME COLUMN responsable  TO assignee;
ALTER TABLE users RENAME COLUMN correo       TO email;
ALTER TABLE users RENAME COLUMN telefono     TO phone;
ALTER TABLE users RENAME COLUMN rol          TO role;
ALTER TABLE users RENAME COLUMN user_active  TO is_active;
ALTER TABLE users RENAME COLUMN sector       TO region;
ALTER TABLE users RENAME COLUMN cargo        TO job_title;
ALTER TABLE users RENAME COLUMN cedula       TO document_number;


-- ============================================================
-- BLOQUE 3: Renombrar columnas — invoices (era: facturas)
-- ============================================================

ALTER TABLE invoices RENAME COLUMN id_factura        TO invoice_id;
ALTER TABLE invoices RENAME COLUMN num_factura        TO invoice_number;
ALTER TABLE invoices RENAME COLUMN fecha_factura      TO invoice_date;
ALTER TABLE invoices RENAME COLUMN monto_factura      TO invoice_amount;
ALTER TABLE invoices RENAME COLUMN responsable        TO assignee;
ALTER TABLE invoices RENAME COLUMN tipo_servicio      TO service_type;
ALTER TABLE invoices RENAME COLUMN tipo_factura       TO invoice_type;
ALTER TABLE invoices RENAME COLUMN nit_factura        TO vendor_tax_id;
ALTER TABLE invoices RENAME COLUMN razon_social       TO company_name;
ALTER TABLE invoices RENAME COLUMN nombre_bia         TO billed_to_bia;
ALTER TABLE invoices RENAME COLUMN observacion        TO notes;
ALTER TABLE invoices RENAME COLUMN adjuntar_factura   TO attachment_url;
ALTER TABLE invoices RENAME COLUMN estado             TO status;
ALTER TABLE invoices RENAME COLUMN ciudad             TO city;
ALTER TABLE invoices RENAME COLUMN sector             TO region;
ALTER TABLE invoices RENAME COLUMN centro_costo       TO cost_center;
ALTER TABLE invoices RENAME COLUMN info_centro_costo  TO cost_center_info;
ALTER TABLE invoices RENAME COLUMN motivo_rechazo     TO rejection_reason;
ALTER TABLE invoices RENAME COLUMN entrega_id         TO transfer_id;
ALTER TABLE invoices RENAME COLUMN fecha_creacion     TO submitted_at;


-- ============================================================
-- BLOQUE 4: Renombrar columnas — transfers (era: envios)
-- ============================================================

ALTER TABLE transfers RENAME COLUMN id_envio     TO transfer_id;
ALTER TABLE transfers RENAME COLUMN responsable  TO assignee;
ALTER TABLE transfers RENAME COLUMN monto        TO amount;
ALTER TABLE transfers RENAME COLUMN sector       TO region;
ALTER TABLE transfers RENAME COLUMN comprobante  TO voucher_number;


-- ============================================================
-- BLOQUE 5: Renombrar columnas — deliveries (era: entregas)
-- ============================================================

ALTER TABLE deliveries RENAME COLUMN id_entrega            TO delivery_id;
ALTER TABLE deliveries RENAME COLUMN fecha_entrega         TO delivery_date;
ALTER TABLE deliveries RENAME COLUMN id_envio              TO transfer_id;
ALTER TABLE deliveries RENAME COLUMN responsable           TO assignee;
ALTER TABLE deliveries RENAME COLUMN monto_entregado       TO delivered_amount;
ALTER TABLE deliveries RENAME COLUMN saldo_total_entregado TO cumulative_delivered;
ALTER TABLE deliveries RENAME COLUMN aceptar               TO confirmed;
ALTER TABLE deliveries RENAME COLUMN firma                 TO signature;


-- ============================================================
-- BLOQUE 6: Renombrar columnas — expense_reports (era: legalizaciones)
-- ============================================================

ALTER TABLE expense_reports RENAME COLUMN id_reporte        TO report_id;
ALTER TABLE expense_reports RENAME COLUMN coordinador       TO coordinator;
ALTER TABLE expense_reports RENAME COLUMN sector            TO region;
ALTER TABLE expense_reports RENAME COLUMN total_aprobado    TO approved_total;
ALTER TABLE expense_reports RENAME COLUMN estado            TO status;
ALTER TABLE expense_reports RENAME COLUMN observacion       TO notes;
ALTER TABLE expense_reports RENAME COLUMN url_reporte       TO report_url;
ALTER TABLE expense_reports RENAME COLUMN periodo_desde     TO period_start;
ALTER TABLE expense_reports RENAME COLUMN periodo_hasta     TO period_end;
ALTER TABLE expense_reports RENAME COLUMN facturas_ids      TO invoice_ids;
ALTER TABLE expense_reports RENAME COLUMN firma_coordinador TO coordinator_signature;
ALTER TABLE expense_reports RENAME COLUMN firma_admin       TO admin_signature;
ALTER TABLE expense_reports RENAME COLUMN resumen_ia        TO ai_summary;
ALTER TABLE expense_reports RENAME COLUMN fecha_creacion    TO submitted_at;


-- ============================================================
-- BLOQUE 7: Renombrar columnas — expenses (era: gastos_generales)
-- ============================================================

ALTER TABLE expenses RENAME COLUMN id_gasto      TO expense_id;
ALTER TABLE expenses RENAME COLUMN descripcion   TO description;
ALTER TABLE expenses RENAME COLUMN monto         TO amount;
ALTER TABLE expenses RENAME COLUMN categoria     TO category;
ALTER TABLE expenses RENAME COLUMN responsable   TO assignee;
ALTER TABLE expenses RENAME COLUMN sector        TO region;
ALTER TABLE expenses RENAME COLUMN comprobante   TO voucher_number;
ALTER TABLE expenses RENAME COLUMN estado        TO status;
ALTER TABLE expenses RENAME COLUMN cargo         TO job_title;
ALTER TABLE expenses RENAME COLUMN ciudad        TO city;
ALTER TABLE expenses RENAME COLUMN motivo        TO reason;
ALTER TABLE expenses RENAME COLUMN fecha_inicio  TO start_date;
ALTER TABLE expenses RENAME COLUMN fecha_fin     TO end_date;
ALTER TABLE expenses RENAME COLUMN concepto      TO concept;
ALTER TABLE expenses RENAME COLUMN centro_costos TO cost_center;
ALTER TABLE expenses RENAME COLUMN fecha_factura TO invoice_date;
ALTER TABLE expenses RENAME COLUMN fecha_creacion TO submitted_at;


-- ============================================================
-- BLOQUE 8: Renombrar columnas — expense_groups (era: gastos_grupos)
-- ============================================================

ALTER TABLE expense_groups RENAME COLUMN id_gasto      TO group_id;
ALTER TABLE expense_groups RENAME COLUMN grupo         TO group_name;
ALTER TABLE expense_groups RENAME COLUMN descripcion   TO description;
ALTER TABLE expense_groups RENAME COLUMN monto         TO amount;
ALTER TABLE expense_groups RENAME COLUMN responsable   TO assignee;
ALTER TABLE expense_groups RENAME COLUMN sector        TO region;
ALTER TABLE expense_groups RENAME COLUMN estado        TO status;
ALTER TABLE expense_groups RENAME COLUMN cargo         TO job_title;
ALTER TABLE expense_groups RENAME COLUMN motivo        TO reason;
ALTER TABLE expense_groups RENAME COLUMN fecha_inicio  TO start_date;
ALTER TABLE expense_groups RENAME COLUMN fecha_fin     TO end_date;
ALTER TABLE expense_groups RENAME COLUMN gastos_ids    TO expense_ids;
ALTER TABLE expense_groups RENAME COLUMN firma         TO signature;
ALTER TABLE expense_groups RENAME COLUMN centro_costos TO cost_center;
ALTER TABLE expense_groups RENAME COLUMN fecha_creacion TO submitted_at;


-- ============================================================
-- BLOQUE 9: Renombrar columnas — bot_sessions (era: sesiones_bot)
-- ============================================================

ALTER TABLE bot_sessions RENAME COLUMN estado        TO status;
ALTER TABLE bot_sessions RENAME COLUMN datos_temp    TO session_data;
ALTER TABLE bot_sessions RENAME COLUMN ultimo_mensaje TO last_message_at;
ALTER TABLE bot_sessions RENAME COLUMN responsable   TO assignee;


-- ============================================================
-- BLOQUE 10: Convertir columnas ENUM a TEXT
-- Los VALUES (Pendiente, Aprobada, etc.) NO se cambian — son datos de dominio
-- que el frontend muestra directamente al usuario. Cambiarlos rompería la UI.
-- Solo convertimos el tipo de columna de ENUM a TEXT para mayor flexibilidad.
-- ============================================================

ALTER TABLE invoices        ALTER COLUMN status TYPE TEXT USING (status::TEXT);
ALTER TABLE expenses        ALTER COLUMN status TYPE TEXT USING (status::TEXT);
ALTER TABLE expense_groups  ALTER COLUMN status TYPE TEXT USING (status::TEXT);
ALTER TABLE expense_reports ALTER COLUMN status TYPE TEXT USING (status::TEXT);
ALTER TABLE users           ALTER COLUMN role   TYPE TEXT USING (role::TEXT);

-- Eliminar tipos ENUM viejos (ya no los usa ninguna columna)
-- Si la DB tiene otros objetos dependientes del tipo, estos DROP fallarán —
-- en ese caso comentar las líneas (no afecta el funcionamiento).
DROP TYPE IF EXISTS micaja.estado_factura CASCADE;
DROP TYPE IF EXISTS public.estado_factura CASCADE;


-- ============================================================
-- BLOQUE 11: Renombrar índices (cosmético — los viejos seguirían funcionando)
-- ============================================================

ALTER INDEX IF EXISTS usuarios_correo_idx            RENAME TO users_email_idx;
ALTER INDEX IF EXISTS facturas_id_factura_idx         RENAME TO invoices_invoice_id_idx;
ALTER INDEX IF EXISTS facturas_responsable_idx        RENAME TO invoices_assignee_idx;
ALTER INDEX IF EXISTS facturas_estado_idx             RENAME TO invoices_status_idx;
ALTER INDEX IF EXISTS facturas_entrega_id_idx         RENAME TO invoices_transfer_id_idx;
ALTER INDEX IF EXISTS envios_id_envio_idx             RENAME TO transfers_transfer_id_idx;
ALTER INDEX IF EXISTS entregas_id_envio_idx           RENAME TO deliveries_transfer_id_idx;
ALTER INDEX IF EXISTS legalizaciones_id_reporte_idx   RENAME TO expense_reports_report_id_idx;
ALTER INDEX IF EXISTS legalizaciones_coordinador_idx  RENAME TO expense_reports_coordinator_idx;
ALTER INDEX IF EXISTS gastos_generales_id_idx         RENAME TO expenses_expense_id_idx;
ALTER INDEX IF EXISTS gastos_grupos_id_idx            RENAME TO expense_groups_group_id_idx;
ALTER INDEX IF EXISTS sesiones_bot_chat_id_idx        RENAME TO bot_sessions_chat_id_idx;


-- ============================================================
-- VERIFICACIÓN (descomentar para revisar ANTES de hacer COMMIT)
-- ============================================================

-- SELECT table_name
-- FROM information_schema.tables
-- WHERE table_schema = 'public'
-- ORDER BY table_name;

-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'invoices'
-- ORDER BY ordinal_position;

-- SELECT DISTINCT status FROM invoices;
-- SELECT DISTINCT status FROM expenses;
-- SELECT DISTINCT status FROM expense_reports;
-- SELECT DISTINCT role   FROM users;


COMMIT;

-- =============================================================================
-- Si algo falló antes del COMMIT: ejecutar ROLLBACK; y nada habrá cambiado.
-- =============================================================================
