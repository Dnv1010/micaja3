-- Verifica que no haya filas donde url difiera de attachment_url antes de eliminar.
-- Debe retornar 0 para proceder.
SELECT COUNT(*)
FROM micaja.invoices
WHERE url IS DISTINCT FROM attachment_url;

-- Elimina la columna redundante url (usa attachment_url como nombre estándar).
ALTER TABLE micaja.invoices DROP COLUMN url;
