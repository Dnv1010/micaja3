# RENAMES.md — Glosario de renombrado español → inglés

**Estado:** APROBADO  
**Rama:** `refactor/db-english-names`  
**Estrategia:** Opción B — constantes TypeScript para nombres de tabla; columnas se renombran en Fase 2.

---

## Tablas

| Tabla actual        | Tabla nueva      |
|---------------------|------------------|
| `usuarios`          | `users`          |
| `facturas`          | `invoices`       |
| `envios`            | `transfers`      |
| `entregas`          | `deliveries`     |
| `legalizaciones`    | `expense_reports`|
| `gastos_generales`  | `expenses`       |
| `gastos_grupos`     | `expense_groups` |
| `sesiones_bot`      | `bot_sessions`   |

---

## Valores de enum (TEXT en DB — requieren UPDATE de datos en Fase 2)

### `status` — invoices, expenses, expense_groups
| Valor actual  | Valor nuevo   |
|---------------|---------------|
| `"Pendiente"` | `"pending"`   |
| `"Aprobada"`  | `"approved"`  |
| `"Rechazada"` | `"rejected"`  |
| `"Completada"`| `"completed"` |

### `status` — expense_reports
| Valor actual        | Valor nuevo      |
|---------------------|------------------|
| `"Pendiente Admin"` | `"pending_admin"`|
| `"Firmado"`         | `"signed"`       |

### `role` — users
| Valor actual   | Valor nuevo    |
|----------------|----------------|
| `"coordinador"`| `"coordinator"`|
| `"admin"`      | `"admin"` ← sin cambio |
| `"user"`       | `"user"` ← sin cambio  |

### `region` — todas las tablas
| Valor actual    | Valor nuevo                     |
|-----------------|---------------------------------|
| `"Bogota"`      | `"Bogota"` ← sin cambio (nombre propio) |
| `"Costa Caribe"`| `"Costa Caribe"` ← sin cambio  |

---

## Columnas por tabla

> **Convención:** snake_case en inglés.  
> Columnas sin cambio se omiten (`id`, `created_at`, `updated_at`, `url`, `pdf_url`, `ops`, `pin`, `nit`, `drive_file_id`, `telegram_chat_id`).

### `users` (era: `usuarios`)
| Columna actual    | Columna nueva    |
|-------------------|------------------|
| `responsable`     | `assignee`       |
| `correo`          | `email`          |
| `telefono`        | `phone`          |
| `rol`             | `role`           |
| `user_active`     | `is_active`      |
| `sector`          | `region`         |
| `cargo`           | `job_title`      |
| `cedula`          | `document_number`|

### `invoices` (era: `facturas`)
| Columna actual     | Columna nueva     |
|--------------------|-------------------|
| `id_factura`       | `invoice_id`      |
| `num_factura`      | `invoice_number`  |
| `fecha_factura`    | `invoice_date`    |
| `monto_factura`    | `invoice_amount`  |
| `responsable`      | `assignee`        |
| `tipo_servicio`    | `service_type`    |
| `tipo_factura`     | `invoice_type`    |
| `nit_factura`      | `vendor_tax_id`   |
| `razon_social`     | `company_name`    |
| `nombre_bia`       | `billed_to_bia`   |
| `observacion`      | `notes`           |
| `adjuntar_factura` | `attachment_url`  |
| `estado`           | `status`          |
| `ciudad`           | `city`            |
| `sector`           | `region`          |
| `centro_costo`     | `cost_center`     |
| `info_centro_costo`| `cost_center_info`|
| `motivo_rechazo`   | `rejection_reason`|
| `entrega_id`       | `transfer_id`     |
| `fecha_creacion`   | `submitted_at`    |

> `entrega_id` apunta a `envios.id_envio` → renombrado a `transfer_id` para reflejar su FK real.

### `transfers` (era: `envios`)
| Columna actual | Columna nueva    |
|----------------|------------------|
| `id_envio`     | `transfer_id`    |
| `responsable`  | `assignee`       |
| `monto`        | `amount`         |
| `sector`       | `region`         |
| `comprobante`  | `voucher_number` |

### `deliveries` (era: `entregas`)
| Columna actual          | Columna nueva          |
|-------------------------|------------------------|
| `id_entrega`            | `delivery_id`          |
| `fecha_entrega`         | `delivery_date`        |
| `id_envio`              | `transfer_id`          |
| `responsable`           | `assignee`             |
| `monto_entregado`       | `delivered_amount`     |
| `saldo_total_entregado` | `cumulative_delivered` |
| `aceptar`               | `confirmed`            |
| `firma`                 | `signature`            |

### `expense_reports` (era: `legalizaciones`)
| Columna actual      | Columna nueva           |
|---------------------|-------------------------|
| `id_reporte`        | `report_id`             |
| `coordinador`       | `coordinator`           |
| `sector`            | `region`                |
| `total_aprobado`    | `approved_total`        |
| `estado`            | `status`                |
| `observacion`       | `notes`                 |
| `url_reporte`       | `report_url`            |
| `periodo_desde`     | `period_start`          |
| `periodo_hasta`     | `period_end`            |
| `facturas_ids`      | `invoice_ids`           |
| `firma_coordinador` | `coordinator_signature` |
| `firma_admin`       | `admin_signature`       |
| `resumen_ia`        | `ai_summary`            |
| `fecha_creacion`    | `submitted_at`          |

### `expenses` (era: `gastos_generales`)
| Columna actual | Columna nueva    |
|----------------|------------------|
| `id_gasto`     | `expense_id`     |
| `descripcion`  | `description`    |
| `monto`        | `amount`         |
| `categoria`    | `category`       |
| `responsable`  | `assignee`       |
| `sector`       | `region`         |
| `comprobante`  | `voucher_number` |
| `estado`       | `status`         |
| `cargo`        | `job_title`      |
| `ciudad`       | `city`           |
| `motivo`       | `reason`         |
| `fecha_inicio` | `start_date`     |
| `fecha_fin`    | `end_date`       |
| `concepto`     | `concept`        |
| `centro_costos`| `cost_center`    |
| `fecha_factura`| `invoice_date`   |
| `fecha_creacion`| `submitted_at`  |

### `expense_groups` (era: `gastos_grupos`)
| Columna actual | Columna nueva    |
|----------------|------------------|
| `id_gasto`     | `group_id`       |
| `grupo`        | `group_name`     |
| `descripcion`  | `description`    |
| `monto`        | `amount`         |
| `responsable`  | `assignee`       |
| `sector`       | `region`         |
| `estado`       | `status`         |
| `cargo`        | `job_title`      |
| `motivo`       | `reason`         |
| `fecha_inicio` | `start_date`     |
| `fecha_fin`    | `end_date`       |
| `gastos_ids`   | `expense_ids`    |
| `firma`        | `signature`      |
| `centro_costos`| `cost_center`    |
| `fecha_creacion`| `submitted_at`  |

> `id_gasto` se renombra a `group_id` aquí (no `expense_id`) para no confundir con `expenses.expense_id`.

### `bot_sessions` (era: `sesiones_bot`)
| Columna actual | Columna nueva |
|----------------|---------------|
| `estado`       | `status`      |
| `datos`        | `data`        |

> Los valores del campo `paso` dentro del JSONB `data` son internos al bot y NO se modifican.

---

## Índices a renombrar (Fase 2, cosmético — no afectan queries)

| Índice actual                     | Índice nuevo                         |
|-----------------------------------|--------------------------------------|
| `usuarios_correo_idx`             | `users_email_idx`                    |
| `facturas_id_factura_idx`         | `invoices_invoice_id_idx`            |
| `facturas_responsable_idx`        | `invoices_assignee_idx`              |
| `facturas_estado_idx`             | `invoices_status_idx`                |
| `facturas_entrega_id_idx`         | `invoices_transfer_id_idx`           |
| `envios_id_envio_idx`             | `transfers_transfer_id_idx`          |
| `entregas_id_envio_idx`           | `deliveries_transfer_id_idx`         |
| `legalizaciones_id_reporte_idx`   | `expense_reports_report_id_idx`      |
| `legalizaciones_coordinador_idx`  | `expense_reports_coordinator_idx`    |
| `gastos_generales_id_idx`         | `expenses_expense_id_idx`            |
| `gastos_grupos_id_idx`            | `expense_groups_group_id_idx`        |
| `sesiones_bot_chat_id_idx`        | `bot_sessions_chat_id_idx`           |

---

## Lo que NO cambia

- Valores de `sector`: `"Bogota"` y `"Costa Caribe"` (nombres propios geográficos)
- Columnas ya en inglés: `id`, `created_at`, `updated_at`, `url`, `pdf_url`, `ops`, `pin`, `nit`, `drive_file_id`, `telegram_chat_id`, `chat_id`
- Librería NextAuth: se mantiene (está en uso activo)
- Valores internos del JSONB `data` en `bot_sessions` (campo `paso` y datos del bot)
- Storage bucket name: `micaja-files` (no es nombre de tabla)
