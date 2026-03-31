"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Session } from "next-auth";
import { FileText, LayoutDashboard, Send, Users, Package, FileBarChart2 } from "lucide-react";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

function navByRole(rol: string): NavItem[] {
  if (rol === "admin") {
    return [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/reportes", label: "Reportes", icon: FileBarChart2 },
      { href: "/admin/facturas", label: "Todas las Facturas", icon: FileText },
      { href: "/admin/usuarios", label: "Usuarios", icon: Users },
    ];
  }
  if (rol === "coordinador") {
    return [
      { href: "/", label: "Usuarios", icon: Users },
      { href: "/envios", label: "Envios", icon: Send },
      { href: "/facturas", label: "Facturas", icon: FileText },
      { href: "/reporte", label: "Reporte", icon: FileBarChart2 },
    ];
  }
  return [
    { href: "/", label: "Mi Cuenta", icon: LayoutDashboard },
    { href: "/facturas", label: "Facturas", icon: FileText },
    { href: "/entregas", label: "Entregas", icon: Package },
  ];
}

export function SidebarNav({
  session,
  className,
}: {
  session: Session;
  className?: string;
}) {
  const pathname = usePathname();
  const rol = String(session.user?.rol || "user").toLowerCase();
  const items = navByRole(rol);

  return (
    <nav
      className={cn(
        "flex flex-col gap-1 border-r bg-sidebar p-4 min-h-screen w-64",
        className
      )}
    >
      <div className="mb-6 px-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">BIA Energy</p>
        <p className="text-lg font-bold">{process.env.NEXT_PUBLIC_APP_NAME || "MiCaja"}</p>
        <p className="text-xs text-muted-foreground">Caja menor</p>
      </div>
      {items.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors min-h-[44px]",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent/60"
            )}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
