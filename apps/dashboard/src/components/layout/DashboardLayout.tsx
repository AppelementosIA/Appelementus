import { Outlet } from "react-router-dom";
import { SidebarPlatform } from "./SidebarPlatform";

export function DashboardLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <SidebarPlatform />
      <main className="flex-1 overflow-y-auto bg-muted/30">
        <Outlet />
      </main>
    </div>
  );
}
