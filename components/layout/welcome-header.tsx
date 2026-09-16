"use client";

import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Notifications } from "./notifications";
import { useTheme } from "next-themes";
import { Moon, Sun, Settings, Menu } from "lucide-react";
import { getInitials } from "@/lib/utils";
import type { User } from "@/types";

interface WelcomeHeaderProps {
  user: User;
  onMenuClick?: () => void;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 4 && h < 11) return "Selamat pagi";
  if (h >= 11 && h < 15) return "Selamat siang";
  if (h >= 15 && h < 18) return "Selamat sore";
  return "Selamat malam";
}

/**
 * Professional dashboard greeting: avatar + time-based greeting with the
 * user's name, and quick actions on the right (notifications, settings,
 * dark/light toggle). On mobile the hamburger is shown instead.
 */
export function WelcomeHeader({ user, onMenuClick }: WelcomeHeaderProps) {
  const { theme, setTheme } = useTheme();
  const greetingText = getGreeting();
  const firstName = user.name.split(" ")[0];

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        {/* Hamburger on mobile */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden h-10 w-10 flex-shrink-0"
          onClick={onMenuClick}
          aria-label="Buka menu"
        >
          <Menu className="w-5 h-5" />
        </Button>

        <Link href="/profile" className="flex items-center gap-3 min-w-0 group">
          <Avatar className="h-11 w-11 border-2 border-white dark:border-gray-800 shadow-md flex-shrink-0">
            <AvatarImage src={user.avatar_url} alt={user.name} />
            <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-sm font-bold">
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-tight">
              {greetingText},
            </p>
            <p className="text-lg font-bold text-gray-900 dark:text-white leading-tight truncate group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
              {firstName}
            </p>
          </div>
        </Link>
      </div>

      {/* Quick actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Ganti tema terang/gelap"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>

        <Notifications userId={user.id} />

        <Link href="/profile">
          <Button variant="ghost" size="icon" className="h-10 w-10" aria-label="Pengaturan">
            <Settings className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
