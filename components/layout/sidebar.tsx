"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  GraduationCap, Home, FileSpreadsheet,
  LayoutDashboard, LogOut, Star, Users, UserCheck, FileText, BookMarked,
  PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/logo";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { UserRole } from "@/types";

interface SidebarProps {
  role: UserRole;
  collapsed?: boolean;
  onToggle?: () => void;
}

const teacherNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/classes", label: "Classes", icon: Users },
  { href: "/attendance", label: "Attendance", icon: UserCheck },
  { href: "/grades", label: "Grades", icon: Star },
  { href: "/rapor", label: "Rapor Export", icon: FileSpreadsheet },
  { href: "/quiz", label: "Assessment", icon: FileText },
  { href: "/teaching-aids", label: "Teaching Aids", icon: BookMarked },
];

const studentNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/classes", label: "My Classes", icon: GraduationCap },
  { href: "/attendance", label: "Attendance", icon: UserCheck },
  { href: "/grades", label: "My Grades", icon: Star },
  { href: "/quiz", label: "Assessment", icon: FileText },
];

// Bottom nav items (most used, max 5)
const teacherBottomNav = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/classes", label: "Classes", icon: Users },
  { href: "/attendance", label: "Attend", icon: UserCheck },
  { href: "/grades", label: "Grades", icon: Star },
  { href: "/quiz", label: "Assessment", icon: FileText },
];

const studentBottomNav = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/classes", label: "Classes", icon: GraduationCap },
  { href: "/grades", label: "Grades", icon: Star },
  { href: "/quiz", label: "Assessment", icon: FileText },
  { href: "/attendance", label: "Attend", icon: UserCheck },
];

export function Sidebar({ role, collapsed = false, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const navItems = role === "teacher" ? teacherNavItems : studentNavItems;
  const bottomNavItems = role === "teacher" ? teacherBottomNav : studentBottomNav;

  // Warm the client-side router cache for every destination in the
  // background, shortly after mount — first clicks then feel instant.
  useEffect(() => {
    const t = setTimeout(() => {
      const targets = new Set<string>([
        ...navItems.map((i) => i.href),
        ...bottomNavItems.map((i) => i.href),
        "/profile",
        "/assessment",
        "/materials",
        "/rapor",
        "/teaching-aids",
      ]);
      targets.delete(pathname);
      targets.forEach((href) => router.prefetch(href));
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    router.push("/login");
  };

  return (
    <>
      {/* Desktop sidebar only — mobile navigates via the bottom navbar */}
      <aside
        className={cn(
          "hidden md:flex fixed left-0 top-0 z-50 h-full flex-col bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 shadow-none md:static md:z-auto transition-[width] duration-200 ease-in-out",
          collapsed ? "w-[68px]" : "w-64"
        )}
      >
        {/* Logo */}
        <div className={cn("flex items-center border-b border-gray-100 dark:border-gray-800", collapsed ? "px-3 py-4 justify-center" : "p-4 justify-between")}>
          {collapsed ? (
            <Link href="/dashboard" aria-label="My Classroom" className="flex items-center justify-center w-9 h-9 rounded-xl overflow-hidden shadow-md flex-shrink-0">
              <Logo size={36} className="w-full h-full" />
            </Link>
          ) : (
            <Link href="/dashboard" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl overflow-hidden shadow-md flex-shrink-0">
                <Logo size={36} className="w-full h-full" />
              </div>
              <div>
                <p className="font-bold text-sm text-gray-900 dark:text-white leading-none">My Classroom</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">SMK N 1 Buduran</p>
              </div>
            </Link>
          )}
          {!collapsed && onToggle && (
            <button
              onClick={onToggle}
              aria-label="Collapse sidebar"
              className="hidden md:flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:text-emerald-400 dark:hover:bg-gray-800 transition-all"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Role badge */}
        {collapsed ? (
          <div className="flex justify-center py-3">
            <div
              title={role === "teacher" ? "Teacher" : "Student"}
              className={cn(
                "flex items-center justify-center w-9 h-9 rounded-full text-base",
                role === "teacher"
                  ? "bg-blue-50 dark:bg-blue-900/50"
                  : "bg-emerald-50 dark:bg-emerald-900/50"
              )}
            >
              <span>{role === "teacher" ? "👨‍🏫" : "👨‍🎓"}</span>
            </div>
          </div>
        ) : (
          <div className="px-4 py-3">
            <div className={cn(
              "inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full",
              role === "teacher"
                ? "bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                : "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
            )}>
              <span>{role === "teacher" ? "👨‍🏫" : "👨‍🎓"}</span>
              {role === "teacher" ? "Teacher" : "Student"}
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className={cn("flex-1 py-1 space-y-0.5 overflow-y-auto", collapsed ? "px-2" : "px-3")}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl text-sm font-medium transition-all",
                  collapsed ? "px-2 py-2.5 justify-center" : "px-3 py-2.5",
                  isActive
                    ? "bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 dark:from-emerald-900/50 dark:to-teal-900/50 dark:text-emerald-300 shadow-sm"
                    : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                  isActive
                    ? "bg-emerald-100 dark:bg-emerald-900"
                    : "bg-gray-100 dark:bg-gray-800"
                )}>
                  <Icon className={cn("w-4 h-4", isActive ? "text-emerald-600 dark:text-emerald-400" : "text-gray-500 dark:text-gray-400")} />
                </div>
                {!collapsed && item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className={cn("border-t border-gray-100 dark:border-gray-800 space-y-0.5", collapsed ? "px-2 py-3" : "p-3")}>
          <Link
            href="/"
            title={collapsed ? "Home" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800 transition-all",
              collapsed ? "px-2 py-2.5 justify-center" : "px-3 py-2.5"
            )}
          >
            <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
              <Home className="w-4 h-4 text-gray-500" />
            </div>
            {!collapsed && "Home"}
          </Link>
          <button
            onClick={handleLogout}
            title={collapsed ? "Sign Out" : undefined}
            className={cn(
              "w-full flex items-center gap-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-all",
              collapsed ? "px-2 py-2.5 justify-center" : "px-3 py-2.5"
            )}
          >
            <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
              <LogOut className="w-4 h-4 text-red-500" />
            </div>
            {!collapsed && "Sign Out"}
          </button>
          {collapsed && onToggle && (
            <button
              onClick={onToggle}
              aria-label="Expand sidebar"
              title="Expand sidebar"
              className="w-full flex items-center justify-center px-2 py-2.5 rounded-xl text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:text-emerald-400 dark:hover:bg-gray-800 transition-all"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          )}
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="bottom-nav safe-area-bottom">
        {bottomNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              className={cn(
                "flex flex-col items-center gap-1 px-1 py-1 rounded-xl transition-all min-w-0 flex-1",
                isActive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-gray-400 dark:text-gray-500"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-xl flex items-center justify-center transition-all flex-shrink-0",
                isActive ? "bg-emerald-100 dark:bg-emerald-900" : ""
              )}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-medium leading-none max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
