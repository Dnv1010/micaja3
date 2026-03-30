"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { filterNavForSession } from "@/lib/nav";
import type { Session } from "next-auth";
import {
  LayoutDashboard,
  Truck,
  FileText,
  Scale,
  Users,
  BarChart3,
  FileStack,
  Wallet,
} from "lucide-react";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "/": LayoutDashboard,
  "/entregas": Wallet,
  "/facturas": FileText,
  "/legalizaciones": Scale,
  "/envios": Truck,
  "/informes": FileStack,
  "/usuarios": Users,
  "/balance": BarChart3,
};

export function SidebarNav({
  session,
  className,
}: {
  session: Session;
  className?: string;
}) {
  const pathname = usePathname();
  const items = filterNavForSession(session);

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
        const Icon = ICONS[item.href] || LayoutDashboard;
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
