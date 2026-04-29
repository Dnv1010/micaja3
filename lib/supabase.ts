import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

function resolveUrl(key: string): string {
  const explicit = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (explicit) return explicit.trim();
  // Derivar del JWT del service key: payload.ref → https://<ref>.supabase.co
  const parts = key.split(".");
  if (parts.length !== 3) {
    throw new Error("SUPABASE_SERVICE_KEY inválida (no es un JWT)");
  }
  const payload = JSON.parse(
    Buffer.from(parts[1], "base64").toString("utf8")
  ) as { ref?: string };
  if (!payload.ref) {
    throw new Error("JWT sin 'ref'; define NEXT_PUBLIC_SUPABASE_URL en .env.local");
  }
  return `https://${payload.ref}.supabase.co`;
}

/**
 * Cliente Supabase server-side con service_role key.
 * NUNCA usar desde componentes cliente: salta RLS y tiene acceso total.
 */
export function getSupabase(): SupabaseClient {
  if (cached) return cached;
  const key =
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "Supabase no configurado: defina SUPABASE_SERVICE_KEY en .env.local"
    );
  }
  const url = resolveUrl(key);
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "micaja" },
  }) as unknown as SupabaseClient;
  return cached;
}

export function assertSupabaseConfigured(): void {
  getSupabase();
}
