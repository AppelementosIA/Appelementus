import { Outlet } from "react-router-dom";
import { SidebarPlatform } from "./SidebarPlatform";

export function DashboardLayout() {
  return (
    <div className="min-h-screen bg-muted/30 lg:flex">
      <SidebarPlatform />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
