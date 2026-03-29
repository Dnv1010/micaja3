"use client";

import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { RoleBadge } from "@/components/shared/role-badge";
import { LogOut, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { SidebarNav } from "./sidebar-nav";
import type { Session } from "next-auth";

export function Header({ serverSession }: { serverSession: Session }) {
  const { data } = useSession();
  const user = data?.user ?? serverSession.user;
  const rol = user?.rol || "user";

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex items-center gap-2 md:hidden">
        <Sheet>
          <SheetTrigger className="inline-flex">
            <Button variant="ghost" size="icon" className="shrink-0" aria-label="Abrir menú" type="button">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SidebarNav session={serverSession} className="border-0" />
          </SheetContent>
        </Sheet>
        <span className="font-semibold text-sm truncate">
          {process.env.NEXT_PUBLIC_APP_NAME || "MiCaja"}
        </span>
      </div>

      <div className="hidden md:flex md:flex-1 md:items-center md:justify-end md:gap-3">
        <span className="text-sm text-muted-foreground truncate max-w-[200px]">
          {user?.name || user?.email}
        </span>
        <RoleBadge rol={rol} />
        <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
          <LogOut className="h-4 w-4 mr-2" />
          Salir
        </Button>
      </div>

      <div className="flex items-center gap-2 md:hidden">
        <RoleBadge rol={rol} />
        <Button variant="ghost" size="icon" onClick={() => signOut({ callbackUrl: "/login" })} aria-label="Cerrar sesión">
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
