import { FALLBACK_USERS, findFallbackUserByResponsable } from "@/lib/users-fallback";
import { sectorsEquivalent } from "@/lib/sector-normalize";

/** URL pública de la app (enlaces en mensajes). */
export function appPublicBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, "");
    return `https://${host}`;
  }
  return "https://micaja3-one.vercel.app";
}

export async function enviarWhatsApp(telefono: string, mensaje: string): Promise<boolean> {
  const apiKey = process.env.CALLMEBOT_API_KEY?.trim();
  if (!apiKey) {
    console.warn("[whatsapp] CALLMEBOT_API_KEY no configurada");
    return false;
  }

  const phone = telefono.replace(/[^0-9]/g, "");
  if (!phone || phone.length < 10) {
    console.warn("[whatsapp] Teléfono inválido:", telefono);
    return false;
  }

  const text = encodeURIComponent(mensaje);
  const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${text}&apikey=${apiKey}`;

  try {
    const res = await fetch(url);
    const body = await res.text();
    console.log(`[whatsapp] → ${phone}: ${res.status} ${body.slice(0, 80)}`);
    return res.ok;
  } catch (e) {
    console.error("[whatsapp] Error:", e);
    return false;
  }
}

export function telefonoDeUsuario(responsable: string): string | null {
  const u = findFallbackUserByResponsable(responsable);
  const t = u?.telefono?.trim();
  return t || null;
}

export function telefonosAdmins(): string[] {
  return FALLBACK_USERS.filter(
    (u) => u.rol === "admin" && u.userActive && u.telefono?.trim()
  ).map((u) => u.telefono!.replace(/[^0-9]/g, ""));
}

export function telefonosCoordinadoresZona(sector: string): string[] {
  return FALLBACK_USERS.filter(
    (u) =>
      u.rol === "coordinador" &&
      u.userActive &&
      Boolean(u.telefono?.trim()) &&
      sectorsEquivalent(u.sector, sector)
  ).map((u) => u.telefono!.replace(/[^0-9]/g, ""));
}
