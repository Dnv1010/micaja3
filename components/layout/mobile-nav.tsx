"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Session } from "next-auth";
import { LayoutDashboard, FileText, Package, Send, MoreHorizontal, FileBarChart2 } from "lucide-react";

const SHORT_USER: { href: string; label: string; icon: typeof LayoutDashboard }[] = [
  { href: "/mi-cuenta", label: "Inicio", icon: LayoutDashboard },
  { href: "/facturas", label: "Facturas", icon: FileText },
  { href: "/entregas", label: "Entregas", icon: Package },
];

const SHORT_COORD: { href: string; label: string; icon: typeof LayoutDashboard }[] = [
  { href: "/", label: "Zona", icon: LayoutDashboard },
  { href: "/facturas", label: "Facturas", icon: FileText },
  { href: "/envios", label: "Envíos", icon: Send },
];

const SHORT_ADMIN: { href: string; label: string; icon: typeof LayoutDashboard }[] = [
  { href: "/admin", label: "Inicio", icon: LayoutDashboard },
  { href: "/admin/facturas", label: "Facturas", icon: FileText },
  { href: "/admin/reportes", label: "Reportes", icon: FileBarChart2 },
];

function allowedRoutesByRole(rol: string): string[] {
  if (rol === "admin")
    return ["/admin", "/admin/reportes", "/admin/facturas", "/admin/usuarios"];
  if (rol === "coordinador") return ["/", "/envios", "/facturas", "/reporte", "/legalizaciones"];
  return ["/mi-cuenta", "/facturas", "/entregas"];
}

export function MobileBottomNav({ session }: { session: Session }) {
  const pathname = usePathname();
  const rol = String(session.user?.rol || "user").toLowerCase();
  const allowed = new Set(allowedRoutesByRole(rol));
  const shortList =
    rol === "admin" ? SHORT_ADMIN : rol === "coordinador" ? SHORT_COORD : SHORT_USER;
  const tabs = shortList.filter((s) => allowed.has(s.href));
  const shortTabs = tabs.length
    ? tabs
    : [
        {
          href: rol === "admin" ? "/admin" : rol === "coordinador" ? "/" : "/mi-cuenta",
          label: "Inicio",
          icon: LayoutDashboard,
        },
      ];
  const moreHref =
    Array.from(allowed).find((href) => !shortTabs.some((s) => s.href === href)) ||
    (rol === "admin" ? "/admin" : "/");

  return (
    <nav className="safe-area-pb fixed bottom-0 left-0 right-0 z-40 flex border-t border-bia-gray/20 bg-bia-blue md:hidden">
      {shortTabs.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium min-h-[52px]",
              active ? "font-medium text-bia-aqua" : "text-bia-gray-light"
            )}
          >
            <Icon className={cn("h-6 w-6", active && "text-bia-aqua")} />
            {label}
          </Link>
        );
      })}
      <Link
        href={moreHref === pathname ? (rol === "admin" ? "/admin" : "/") : moreHref}
        className="flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium text-bia-gray-light"
      >
        <MoreHorizontal className="h-6 w-6" />
        Más
      </Link>
    </nav>
  );
}
