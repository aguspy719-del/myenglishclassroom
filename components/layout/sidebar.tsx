"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  ClipboardList,
  GraduationCap,
  Home,
  LayoutDashboard,
  LogOut,
  Star,
  Users,
  UserCheck,
  FileText,
  X,
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

export function Sidebar({ role, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const navItems = role === "teacher" ? teacherNavItems : studentNavItems;

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
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-full w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-transform duration-300 ease-in-out",
          "lg:translate-x-0 lg:static lg:z-auto",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-sm text-gray-900 dark:text-white">English LMS</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Mr. Agus · SMK</p>
            </div>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Role badge */}
        <div className="px-4 py-2">
          <span className={cn(
            "text-xs font-medium px-2 py-1 rounded-full",
            role === "teacher"
              ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
              : "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
          )}>
            {role === "teacher" ? "👨‍🏫 Teacher" : "👨‍🎓 Student"}
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                    : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                )}
              >
                <Icon className={cn("w-5 h-5", isActive ? "text-blue-600 dark:text-blue-400" : "")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 space-y-1">
          <Link
            href="/"
            onClick={onClose}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
          >
            <Home className="w-5 h-5" />
            Home
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
