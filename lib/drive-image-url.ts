/**
 * URLs directas de Google Drive suelen fallar en @react-pdf/renderer; este formato
 * fuerza descarga binaria para que la librería pueda incrustar la imagen.
 */
export function normalizeDriveImageUrlForPdf(url: string): string {
  const u = url.trim();
  if (!u) return u;
  const fromView = u.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (fromView?.[1]) {
    return `https://drive.google.com/uc?export=download&id=${fromView[1]}`;
  }
  // react-pdf suele fallar con uc?id= sin export=download
  if (u.includes("drive.google.com") && u.includes("uc?id=") && !u.includes("export=download")) {
    return u.replace("uc?id=", "uc?export=download&id=");
  }
  const fromId = u.match(/[?&]id=([^&]+)/);
  if (fromId?.[1] && u.includes("drive.google.com")) {
    return `https://drive.google.com/uc?export=download&id=${fromId[1]}`;
  }
  return u;
}

/** Preferir ID de Drive guardado en Sheet para react-pdf (export=download). */
export function facturaAttachmentSrcForPdf(driveFileId?: string, imagenUrl?: string): string | null {
  const id = driveFileId?.trim();
  if (id) return `https://drive.google.com/uc?export=download&id=${id}`;
  const u = imagenUrl?.trim();
  if (u) return normalizeDriveImageUrlForPdf(u);
  return null;
}
