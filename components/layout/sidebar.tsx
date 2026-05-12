"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen, ClipboardList, GraduationCap, Home,
  LayoutDashboard, LogOut, Star, Users, UserCheck, FileText, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { UserRole } from "@/types";

interface SidebarProps {
  role: UserRole;
  isOpen: boolean;
  onClose: () => void;
}

const teacherNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/classes", label: "Classes", icon: Users },
  { href: "/materials", label: "Materials", icon: BookOpen },
  { href: "/assignments", label: "Assignments", icon: ClipboardList },
  { href: "/attendance", label: "Attendance", icon: UserCheck },
  { href: "/grades", label: "Grades", icon: Star },
  { href: "/quiz", label: "Quiz / AKM", icon: FileText },
];

const studentNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/classes", label: "My Classes", icon: GraduationCap },
  { href: "/materials", label: "Materials", icon: BookOpen },
  { href: "/assignments", label: "Assignments", icon: ClipboardList },
  { href: "/attendance", label: "Attendance", icon: UserCheck },
  { href: "/grades", label: "My Grades", icon: Star },
  { href: "/quiz", label: "Quiz", icon: FileText },
];

// Bottom nav items (most used, max 5)
const teacherBottomNav = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/classes", label: "Classes", icon: Users },
  { href: "/assignments", label: "Tasks", icon: ClipboardList },
  { href: "/grades", label: "Grades", icon: Star },
  { href: "/materials", label: "Materials", icon: BookOpen },
];

const studentBottomNav = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/assignments", label: "Tasks", icon: ClipboardList },
  { href: "/materials", label: "Materials", icon: BookOpen },
  { href: "/grades", label: "Grades", icon: Star },
  { href: "/attendance", label: "Attend", icon: UserCheck },
];

export function Sidebar({ role, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const navItems = role === "teacher" ? teacherNavItems : studentNavItems;
  const bottomNavItems = role === "teacher" ? teacherBottomNav : studentBottomNav;

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    router.push("/login");
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={onClose} />
      )}

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-full w-64 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 flex flex-col transition-transform duration-300 ease-in-out shadow-xl",
          "lg:translate-x-0 lg:static lg:z-auto lg:shadow-none",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
          <Link href="/dashboard" className="flex items-center gap-2.5" onClick={onClose}>
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-sm text-gray-900 dark:text-white leading-none">English LMS</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">SMK N 1 Buduran</p>
            </div>
          </Link>
          <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Role badge */}
        <div className="px-4 py-3">
          <div className={cn(
            "inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full",
            role === "teacher"
              ? "bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
              : "bg-green-50 text-green-700 dark:bg-green-900/50 dark:text-green-300"
          )}>
            <span>{role === "teacher" ? "👨‍🏫" : "👨‍🎓"}</span>
            {role === "teacher" ? "Teacher" : "Student"}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-1 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                prefetch={true}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                  isActive
                    ? "bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 dark:from-blue-900/50 dark:to-indigo-900/50 dark:text-blue-300 shadow-sm"
                    : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                  isActive
                    ? "bg-blue-100 dark:bg-blue-900"
                    : "bg-gray-100 dark:bg-gray-800"
                )}>
                  <Icon className={cn("w-4 h-4", isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400")} />
                </div>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className="p-3 border-t border-gray-100 dark:border-gray-800 space-y-0.5">
          <Link
            href="/"
            onClick={onClose}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800 transition-all"
          >
            <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <Home className="w-4 h-4 text-gray-500" />
            </div>
            Home
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-all"
          >
            <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
              <LogOut className="w-4 h-4 text-red-500" />
            </div>
            Sign Out
          </button>
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
                "flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all min-w-0 flex-1",
                isActive
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-gray-400 dark:text-gray-500"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-xl flex items-center justify-center transition-all",
                isActive ? "bg-blue-100 dark:bg-blue-900" : ""
              )}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-medium truncate w-full text-center">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
