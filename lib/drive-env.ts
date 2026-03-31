/** Carpeta raíz compartida (p. ej. MiCaja/Facturas). Prioridad: nueva var, luego legado. */
export function getDriveFacturasRootFolderId(): string | undefined {
  const id = process.env.GOOGLE_DRIVE_FOLDER_ID || process.env.GOOGLE_DRIVE_FACTURAS_FOLDER_ID;
  return id?.trim() || undefined;
}
