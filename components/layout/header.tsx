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
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-bia-gray/20 bg-bia-blue px-4 backdrop-blur supports-[backdrop-filter]:bg-bia-blue/95">
      <div className="flex items-center gap-2 md:hidden">
        <Sheet>
          <SheetTrigger className="inline-flex">
            <Button variant="ghost" size="icon" className="shrink-0 text-bia-gray-light hover:text-white" aria-label="Abrir menÃº" type="button">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 border-bia-gray/20 bg-bia-blue p-0">
            <SidebarNav session={serverSession} className="min-h-screen border-0" />
          </SheetContent>
        </Sheet>
        <span className="flex items-center gap-1.5 truncate text-sm font-semibold text-white">
          <span className="text-bia-aqua" aria-hidden>
            âš¡
          </span>
          Bia Â· {process.env.NEXT_PUBLIC_APP_NAME || "MiCaja"}
        </span>
      </div>

      <div className="hidden md:flex md:flex-1 md:items-center md:justify-end md:gap-3">
        <RoleBadge rol={rol} />
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open("https://turnos.bia.app", "_blank")}
          className="hidden sm:flex items-center gap-1.5 border-[#08DDBC]/30 text-[#08DDBC] hover:bg-[#001035]"
        >
          <span className="text-xs font-bold">📋 App Turnos</span>
        </Button>
        <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
          <LogOut className="mr-2 h-4 w-4" />
          Salir
        </Button>
      </div>

      <div className="flex items-center gap-2 md:hidden">
        <RoleBadge rol={rol} />
        <Button variant="ghost" size="icon" className="text-bia-gray-light hover:text-bia-aqua" onClick={() => signOut({ callbackUrl: "/login" })} aria-label="Cerrar sesiÃ³n">
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
