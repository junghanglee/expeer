import type { ReactNode } from "react";
import { BottomTabBar } from "./BottomTabBar";
import { DesktopSidebar } from "./DesktopSidebar";
import { DesktopAside } from "./DesktopAside";

export function PhoneShell({ children, hideTab }: { children: ReactNode; hideTab?: boolean }) {
  return (
    <div className="desktop-workspace">
      <DesktopSidebar />
      <main className="phone-shell flex-1">
        <div className="phone-canvas flex flex-col">
          <div className="flex-1 anim-fade-up min-h-0">{children}</div>
          {!hideTab && <BottomTabBar />}
        </div>
      </main>
      <DesktopAside />
    </div>
  );
}
