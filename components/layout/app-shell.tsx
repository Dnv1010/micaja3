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
    <div className="h-screen flex flex-col md:flex-row overflow-hidden">
      <aside className="hidden md:block shrink-0">
        <SidebarNav session={session} />
      </aside>
      <div className="flex flex-1 flex-col min-w-0 min-h-0">
        <Header serverSession={session} />
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="mx-auto w-full max-w-6xl p-4 pb-[calc(1rem+52px+env(safe-area-inset-bottom))] md:p-6 md:pb-6">
            {children}
          </div>
        </main>
      </div>
      <MobileBottomNav session={session} />
    </div>
  );
}
