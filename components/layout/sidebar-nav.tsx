"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import type { Session } from "next-auth";
import {
  LayoutDashboard,
  FileText,
  Users,
  Send,
  BarChart3,
  ClipboardList,
  Home,
  Package,
  Scale,
  LogOut,
  Zap,
} from "lucide-react";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

function navByRole(rol: string): NavItem[] {
  if (rol === "admin") {
    return [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/reportes", label: "Reportes", icon: ClipboardList },
      { href: "/admin/facturas", label: "Facturas", icon: FileText },
      { href: "/admin/usuarios", label: "Usuarios", icon: Users },
    ];
  }
  if (rol === "coordinador") {
    return [
      { href: "/", label: "Mi Zona", icon: Users },
      { href: "/envios", label: "Envíos", icon: Send },
      { href: "/facturas", label: "Facturas", icon: FileText },
      { href: "/reporte", label: "Reporte", icon: BarChart3 },
      { href: "/usuarios-zona", label: "Usuarios", icon: Users },
      { href: "/legalizaciones", label: "Legalizaciones", icon: Scale },
    ];
  }
  return [
    { href: "/mi-cuenta", label: "Mi Cuenta", icon: Home },
    { href: "/facturas", label: "Facturas", icon: FileText },
    { href: "/entregas", label: "Entregas", icon: Package },
  ];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "B";
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
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
  const user = session.user;
  const nombre = user?.name || user?.email || "Usuario";
  const cargo = user?.cargo || user?.sector || "";

  return (
    <aside
      className={cn(
        "flex h-full min-h-screen w-64 flex-col border-r border-bia-gray/20 bg-bia-blue",
        className
      )}
    >
      <div className="flex items-center gap-2 border-b border-bia-gray/20 p-6">
        <Zap className="h-7 w-7 shrink-0 text-bia-aqua" aria-hidden strokeWidth={2.25} />
        <div>
          <span className="text-lg font-bold tracking-wide text-white">Bia</span>
          <p className="text-xs text-bia-gray-light">{process.env.NEXT_PUBLIC_APP_NAME || "MiCaja"}</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto py-4">
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "mx-2 flex min-h-[44px] items-center gap-3 rounded-xl px-4 py-3 text-sm transition-colors",
                active
                  ? "border-l-2 border-bia-aqua bg-bia-aqua/10 font-medium text-bia-aqua"
                  : "border-l-2 border-transparent text-bia-gray-light hover:bg-bia-blue-mid hover:text-white"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-bia-gray/20 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bia-aqua/20 text-sm font-bold text-bia-aqua">
            {initials(nombre)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{nombre}</p>
            <p className="truncate text-xs text-bia-gray-light">{cargo || "â€”"}</p>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="shrink-0 text-bia-gray transition-colors hover:text-bia-aqua"
            aria-label="Cerrar sesión"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
