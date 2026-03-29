"use client";

import { Header } from "./header";
import { SidebarNav } from "./sidebar-nav";
import { MobileBottomNav } from "./mobile-nav";
import type { Session } from "next-auth";

export function AppShell({
  session,
  children,
}: {
  session: Session;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col md:flex-row pb-[calc(52px+env(safe-area-inset-bottom))] md:pb-0">
      <aside className="hidden md:block shrink-0">
        <SidebarNav session={session} />
      </aside>
      <div className="flex flex-1 flex-col min-w-0">
        <Header serverSession={session} />
        <main className="flex-1 p-4 md:p-6 max-w-6xl w-full mx-auto">{children}</main>
      </div>
      <MobileBottomNav session={session} />
    </div>
  );
}
