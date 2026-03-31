"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Session } from "next-auth";
import { LayoutDashboard, FileText, Package, MoreHorizontal } from "lucide-react";

const SHORT: { href: string; label: string; icon: typeof LayoutDashboard }[] = [
  { href: "/", label: "Inicio", icon: LayoutDashboard },
  { href: "/facturas", label: "Facturas", icon: FileText },
  { href: "/entregas", label: "Entregas", icon: Package },
];

function allowedRoutesByRole(rol: string): string[] {
  if (rol === "admin") return ["/", "/admin/reportes", "/admin/facturas", "/admin/usuarios"];
  if (rol === "coordinador") return ["/", "/envios", "/facturas", "/reporte"];
  return ["/", "/facturas", "/entregas"];
}

export function MobileBottomNav({ session }: { session: Session }) {
  const pathname = usePathname();
  const rol = String(session.user?.rol || "user").toLowerCase();
  const allowed = new Set(allowedRoutesByRole(rol));
  const tabs = SHORT.filter((s) => allowed.has(s.href));
  const shortTabs = tabs.length ? tabs : [{ href: "/", label: "Inicio", icon: LayoutDashboard }];
  const moreHref = Array.from(allowed).find((href) => !shortTabs.some((s) => s.href === href)) || "/";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t bg-background md:hidden safe-area-pb">
      {shortTabs.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium min-h-[52px]",
              active ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Icon className={cn("h-6 w-6", active && "text-primary")} />
            {label}
          </Link>
        );
      })}
      <Link
        href={moreHref === pathname ? "/" : moreHref}
        className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium text-muted-foreground min-h-[52px]"
      >
        <MoreHorizontal className="h-6 w-6" />
        Más
      </Link>
    </nav>
  );
}
