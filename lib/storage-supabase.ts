import { getSupabase } from "@/lib/supabase";

const BUCKET = "micaja-files";

export type StorageUploadResult = {
  /** Ruta dentro del bucket (p. ej. `facturas/Bogota/2026-04/archivo.jpg`). */
  path: string;
  /** URL pública absoluta (el bucket es público). */
  publicUrl: string;
};

/** Path seguro (sin barras iniciales, sin caracteres raros). */
function sanitizePath(p: string): string {
  return p
    .replace(/^\/+/, "")
    .replace(/\\/g, "/")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._/\-]/g, "");
}

/**
 * Sube un archivo al bucket público `micaja-files`.
 * Retorna la ruta + URL pública (usar esta URL como `src` directamente).
 */
export async function uploadToStorage(
  path: string,
  body: Buffer | Uint8Array | Blob,
  contentType: string
): Promise<StorageUploadResult> {
  const safePath = sanitizePath(path);
  const sb = getSupabase();
  const { error } = await sb.storage.from(BUCKET).upload(safePath, body, {
    contentType,
    upsert: false,
    cacheControl: "3600",
  });
  if (error) throw error;
  const { data } = sb.storage.from(BUCKET).getPublicUrl(safePath);
  return { path: safePath, publicUrl: data.publicUrl };
}

/** Borra un archivo del bucket (por su path). Idempotente: no lanza si no existe. */
export async function deleteFromStorage(path: string): Promise<void> {
  const safePath = sanitizePath(path);
  const { error } = await getSupabase().storage.from(BUCKET).remove([safePath]);
  if (error) console.error("[storage] delete:", error);
}

/** Descarga un archivo como buffer (para adjuntar en emails, etc.). */
export async function downloadFromStorage(path: string): Promise<Buffer | null> {
  const safePath = sanitizePath(path);
  const { data, error } = await getSupabase().storage.from(BUCKET).download(safePath);
  if (error || !data) return null;
  const ab = await data.arrayBuffer();
  return Buffer.from(ab);
}

/** URL pública absoluta para una ruta dada. No hace fetch; solo construye la URL. */
export function publicUrlForPath(path: string): string {
  const safePath = sanitizePath(path);
  const { data } = getSupabase().storage.from(BUCKET).getPublicUrl(safePath);
  return data.publicUrl;
}

/** Host de Supabase Storage (para next.config remotePatterns). */
export function supabaseStorageHost(): string {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  if (url) return new URL(url).hostname;
  return "";
}

/** ¿La URL apunta a nuestro Storage? */
export function isSupabaseStorageUrl(url: string): boolean {
  if (!url) return false;
  return /\/storage\/v1\/object\/public\//.test(url);
}
