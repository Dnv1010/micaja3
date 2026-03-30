import type { Session } from "next-auth";

export type NavItem = { href: string; label: string; roles?: string[] };

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard" },
  { href: "/facturas", label: "Facturas" },
  { href: "/entregas", label: "Entregas", roles: ["admin", "coordinador"] },
  { href: "/legalizaciones", label: "Legalizaciones", roles: ["admin", "coordinador"] },
  { href: "/balance", label: "Balance", roles: ["admin", "coordinador"] },
  { href: "/envios", label: "Envíos", roles: ["admin"] },
  { href: "/informes", label: "Informes", roles: ["admin", "verificador"] },
  { href: "/usuarios", label: "Usuarios", roles: ["admin"] },
];

export function filterNavForSession(session: Session | null): NavItem[] {
  const rol = (session?.user?.rol || "user").toLowerCase();
  return NAV_ITEMS.filter((item) => {
    if (!item.roles?.length) return true;
    return item.roles.includes(rol);
  });
}
