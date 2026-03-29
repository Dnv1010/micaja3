import type { Session } from "next-auth";

export type NavItem = { href: string; label: string; roles?: string[] };

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Inicio" },
  { href: "/entregas", label: "Entregas" },
  { href: "/facturas", label: "Facturas" },
  { href: "/legalizaciones", label: "Legalizaciones" },
  { href: "/envios", label: "Envíos", roles: ["admin", "coordinador"] },
  { href: "/informes", label: "Informes", roles: ["admin", "coordinador", "verificador"] },
  { href: "/usuarios", label: "Usuarios" },
  { href: "/balance", label: "Balance", roles: ["coordinador"] },
];

export function filterNavForSession(session: Session | null): NavItem[] {
  const rol = (session?.user?.rol || "user").toLowerCase();
  return NAV_ITEMS.filter((item) => {
    if (!item.roles?.length) return true;
    return item.roles.includes(rol);
  });
}
