import type { ReactNode } from "react";

import { AppHeader } from "@/components/shared/app-header";
import { DesktopSidebar } from "@/components/shared/desktop-sidebar";
import { MobileBottomNav } from "@/components/shared/mobile-bottom-nav";

type AppShellProps = { children: ReactNode; pageLabel?: string };

export function AppShell({ children, pageLabel }: AppShellProps) {
  return (
    <div className="app-shell">
      <DesktopSidebar />
      <div className="app-shell__workspace">
        <AppHeader pageLabel={pageLabel} />
        <main className="app-shell__main">{children}</main>
      </div>
      <MobileBottomNav />
    </div>
  );
}
