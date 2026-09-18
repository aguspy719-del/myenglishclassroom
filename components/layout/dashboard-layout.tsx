"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Sidebar } from "./sidebar";
import { Navbar } from "./navbar";
import { WelcomeHeader } from "./welcome-header";
import type { User } from "@/types";

interface DashboardLayoutProps {
  user: User;
  children: React.ReactNode;
}

const STORAGE_KEY = "sidebar-collapsed";

export function DashboardLayout({ user, children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Restore the saved collapse state after mount (avoids hydration mismatch)
  useEffect(() => {
    setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      localStorage.setItem(STORAGE_KEY, prev ? "0" : "1");
      return !prev;
    });
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar role={user.role} collapsed={collapsed} onToggle={toggleCollapsed} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Dashboard uses its own greeting header with built-in actions; the
            toggle lives here as a floating button since it has no Navbar */}
        {pathname !== "/dashboard" ? (
          <Navbar user={user} sidebarCollapsed={collapsed} onToggleSidebar={toggleCollapsed} />
        ) : (
          <button
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden md:flex fixed top-4 right-4 z-40 h-9 w-9 items-center justify-center rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-300 dark:hover:border-emerald-700 shadow-sm transition-all"
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        )}
        <main key={pathname} className="page-enter flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-8">
          {pathname === "/dashboard" && (
            <div className="mb-5">
              <WelcomeHeader user={user} />
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
