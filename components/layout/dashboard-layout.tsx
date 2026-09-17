"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Navbar } from "./navbar";
import { WelcomeHeader } from "./welcome-header";
import type { User } from "@/types";

interface DashboardLayoutProps {
  user: User;
  children: React.ReactNode;
}

export function DashboardLayout({ user, children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar
        role={user.role}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Dashboard uses its own greeting header with built-in actions */}
        {pathname !== "/dashboard" && (
          <Navbar user={user} onMenuClick={() => setSidebarOpen(true)} />
        )}
        <main key={pathname} className="page-enter flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-8">
          {pathname === "/dashboard" && (
            <div className="mb-5">
              <WelcomeHeader user={user} onMenuClick={() => setSidebarOpen(true)} />
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
