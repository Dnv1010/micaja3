"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { filterNavForSession } from "@/lib/nav";
import type { Session } from "next-auth";
import {
  LayoutDashboard,
  FileText,
  Wallet,
  Scale,
  MoreHorizontal,
} from "lucide-react";

const SHORT: { href: string; label: string; icon: typeof LayoutDashboard }[] = [
  { href: "/dashboard", label: "Inicio", icon: LayoutDashboard },
  { href: "/facturas", label: "Facturas", icon: FileText },
  { href: "/entregas", label: "Entregas", icon: Wallet },
  { href: "/legalizaciones", label: "Legal.", icon: Scale },
];

export function MobileBottomNav({ session }: { session: Session }) {
  const pathname = usePathname();
  const all = filterNavForSession(session);
  const moreHref = all.find((i) => !SHORT.some((s) => s.href === i.href))?.href || "/dashboard";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t bg-background md:hidden safe-area-pb">
      {SHORT.map(({ href, label, icon: Icon }) => {
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
        href={moreHref === pathname ? "/dashboard" : "/informes"}
        className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium text-muted-foreground min-h-[52px]"
      >
        <MoreHorizontal className="h-6 w-6" />
        Más
      </Link>
    </nav>
  );
}
