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
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 shrink-0 md:block">
        <SidebarNav session={session} />
      </aside>

      <div className="fixed left-0 right-0 top-0 z-40 md:left-64">
        <Header serverSession={session} />
      </div>

      <main className="pt-14 pb-[calc(52px+env(safe-area-inset-bottom))] md:pb-0 md:pl-64">
        <div className="mx-auto w-full max-w-6xl p-4 md:p-6">{children}</div>
      </main>

      <MobileBottomNav session={session} />
    </div>
  );
}
