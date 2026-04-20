/** Firma del canvas: data URL completa o solo base64 (react-pdf requiere data:…). */
export function normalizeFirmaDataUrlForPdf(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  if (t.startsWith("data:image/")) return t;
  return `data:image/png;base64,${t}`;
}

/**
 * Normaliza una URL de imagen/PDF para react-pdf.
 * - Drive (legacy): fuerza `uc?export=download&id=...` para descarga binaria.
 * - Supabase Storage: se devuelve tal cual (ya es URL pública directa).
 * - Cualquier otra: sin cambios.
 */
export function normalizeDriveImageUrlForPdf(url: string): string {
  const u = url.trim();
  if (!u) return u;
  if (!u.includes("drive.google.com")) return u;

  const fromView = u.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (fromView?.[1]) {
    return `https://drive.google.com/uc?export=download&id=${fromView[1]}`;
  }
  if (u.includes("uc?id=") && !u.includes("export=download")) {
    return u.replace("uc?id=", "uc?export=download&id=");
  }
  const fromId = u.match(/[?&]id=([^&]+)/);
  if (fromId?.[1]) {
    return `https://drive.google.com/uc?export=download&id=${fromId[1]}`;
  }
  return u;
}

/**
 * Fuente para react-pdf. Preferencias:
 * 1. Si `imagenUrl` es URL http(s) (Supabase Storage o Drive), úsala (normalizada si es Drive).
 * 2. Si no, y hay un `driveFileId` legacy, construye URL de Drive.
 */
export function facturaAttachmentSrcForPdf(
  driveFileId?: string,
  imagenUrl?: string
): string | null {
  const u = imagenUrl?.trim();
  if (u && (u.startsWith("https://") || u.startsWith("http://"))) {
    return normalizeDriveImageUrlForPdf(u);
  }
  const id = driveFileId?.trim();
  if (id) return `https://drive.google.com/uc?export=download&id=${id}`;
  return null;
}

/**
 * URL para mostrar en la app (img src). Prioridad: URL directa → Adjuntar_Factura → DriveFileId.
 * Para Drive legacy devuelve `uc?id=`; para Supabase Storage la URL pública ya funciona como src.
 */
export function facturaImageUrlForDisplay(
  adjuntarFactura?: string,
  url?: string,
  driveFileId?: string
): string | null {
  const candidates = [url, adjuntarFactura].map((s) => s?.trim()).filter(Boolean) as string[];
  for (const u of candidates) {
    if (u.startsWith("https://") || u.startsWith("http://")) return u;
    if (u.startsWith("Facturas_Images/") || u.startsWith("Facturas/")) continue;
  }
  const id = driveFileId?.trim();
  if (id) return `https://drive.google.com/uc?id=${id}`;
  return null;
}
