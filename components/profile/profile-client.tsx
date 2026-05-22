"use client";

import { useState, useEffect } from "react";
import { User as UserIcon, Mail, Shield, Loader2, Save, Star, Trophy, Bell, BellOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { getInitials, formatDate } from "@/lib/utils";
import { BADGES, POINTS_PER_LEVEL } from "@/lib/gamification";
import { subscribeToPush, unsubscribeFromPush } from "@/lib/push-notifications";
import type { User } from "@/types";

interface ProfileClientProps {
  user: User;
}

export function ProfileClient({ user: initialUser }: ProfileClientProps) {
  const [user, setUser] = useState(initialUser);
  const [name, setName] = useState(initialUser.name);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwords, setPasswords] = useState({ new: "", confirm: "" });
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">("default");
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotifPermission(Notification.permission);
    } else {
      setNotifPermission("unsupported");
    }
  }, []);

  const handleToggleNotifications = async () => {
    setSubscribing(true);
    try {
      if (notifPermission === "granted") {
        await unsubscribeFromPush();
        setNotifPermission("default");
        toast.success("Notifications disabled");
      } else {
        const ok = await subscribeToPush(user.id);
        if (ok) {
          setNotifPermission("granted");
          toast.success("Notifications enabled! 🔔");
        } else {
          toast.error("Could not enable notifications. Please allow in browser settings.");
        }
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubscribing(false);
    }
  };

  const points = (user as any).points || 0;
  const level = (user as any).level || 1;
  const badges: string[] = (user as any).badges || [];
  const pointsInCurrentLevel = points % POINTS_PER_LEVEL;
  const progressPercent = Math.round((pointsInCurrentLevel / POINTS_PER_LEVEL) * 100);
  const pointsToNextLevel = POINTS_PER_LEVEL - pointsInCurrentLevel;

  const handleSaveName = async () => {
    if (!name.trim()) { toast.error("Name cannot be empty"); return; }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("users").update({ name }).eq("id", user.id);
    if (error) toast.error("Failed to save name");
    else { toast.success("Name updated!"); setUser({ ...user, name }); }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (!passwords.new || !passwords.confirm) { toast.error("Fill in all password fields"); return; }
    if (passwords.new !== passwords.confirm) { toast.error("Passwords do not match"); return; }
    if (passwords.new.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setChangingPassword(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: passwords.new });
    if (error) toast.error("Failed: " + error.message);
    else { toast.success("Password changed!"); setPasswords({ new: "", confirm: "" }); }
    setChangingPassword(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Profile</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your account and view achievements</p>
      </div>

      {/* Profile Hero Card */}
      <Card className="border-0 shadow-sm overflow-hidden">
        {/* Banner — nama & email di dalam */}
        <div className="h-24 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-6 flex flex-col justify-center">
          <h2 className="text-white text-xl font-bold leading-tight truncate">{user.name}</h2>
          <p className="text-blue-200 text-sm truncate mt-0.5">{user.email}</p>
        </div>
        {/* Putih — avatar setengah keluar dari banner */}
        <CardContent className="pt-0 pb-6">
          {/* Avatar + Badge row */}
          <div className="flex items-center gap-4 px-2 mb-6">
            <div className="-mt-8 flex-shrink-0">
              <div className="w-20 h-20 rounded-full border-4 border-white dark:border-gray-900 bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-xl">
                <span className="text-white text-2xl font-bold">{getInitials(user.name)}</span>
              </div>
            </div>
            <div className="mt-3">
              <Badge className={user.role === "teacher"
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                : "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"}>
                {user.role === "teacher" ? "👨‍🏫 Teacher" : "👨‍🎓 Student"}
              </Badge>
            </div>
          </div>

          {/* Gamification stats — students only */}
          {user.role === "student" && (
            <div className="space-y-4">
              {/* Level & XP */}
              <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-2xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
                      <span className="text-white font-bold text-sm">{level}</span>
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white">Level {level}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{points} XP total</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">{pointsToNextLevel} XP</p>
                    <p className="text-xs text-gray-500">to Level {level + 1}</p>
                  </div>
                </div>
                <Progress value={progressPercent} className="h-3 rounded-full" />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 text-center">
                  {pointsInCurrentLevel} / {POINTS_PER_LEVEL} XP
                </p>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Level", value: level, icon: "⚡", color: "bg-yellow-50 dark:bg-yellow-950" },
                  { label: "Total XP", value: points, icon: "🎯", color: "bg-blue-50 dark:bg-blue-950" },
                  { label: "Badges", value: badges.length, icon: "🏅", color: "bg-purple-50 dark:bg-purple-950" },
                ].map((stat) => (
                  <div key={stat.label} className={`${stat.color} rounded-2xl p-4 text-center`}>
                    <p className="text-2xl">{stat.icon}</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{stat.value}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Badges — students only */}
      {user.role === "student" && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              Badges & Achievements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {BADGES.map((badge) => {
                const earned = badges.includes(badge.id);
                return (
                  <div
                    key={badge.id}
                    className={`relative p-3 rounded-2xl text-center transition-all ${
                      earned
                        ? `bg-gradient-to-br ${badge.color} shadow-md`
                        : "bg-gray-100 dark:bg-gray-800 opacity-40 grayscale"
                    }`}
                  >
                    <p className="text-3xl mb-1">{badge.icon}</p>
                    <p className={`text-xs font-bold ${earned ? "text-white" : "text-gray-500"}`}>
                      {badge.name}
                    </p>
                    <p className={`text-xs mt-0.5 ${earned ? "text-white/80" : "text-gray-400"} line-clamp-2`}>
                      {badge.description}
                    </p>
                    {earned && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs">✓</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Name */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <UserIcon className="w-4 h-4" />
            Edit Name
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="flex-1 rounded-xl" />
            <Button onClick={handleSaveName} disabled={saving || name === user.name} className="gap-2 rounded-xl">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Account Info */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Account Info
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
            <div>
              <p className="text-xs text-gray-500">Email</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{user.email}</p>
            </div>
            <Badge variant="success" className="text-xs">Verified</Badge>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl mt-2">
            <div>
              <p className="text-xs text-gray-500">Member since</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(user.created_at)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Push Notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          {notifPermission === "unsupported" ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Push notifications are not supported on this browser.
            </p>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {notifPermission === "granted" ? "Notifications are ON" : "Notifications are OFF"}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {notifPermission === "granted"
                    ? "You'll receive alerts for new assignments, grades, and assessments."
                    : "Enable to get alerts for new assignments, grades, and assessments."}
                </p>
              </div>
              <Button
                variant={notifPermission === "granted" ? "outline" : "default"}
                size="sm"
                className="gap-2 rounded-xl flex-shrink-0"
                onClick={handleToggleNotifications}
                disabled={subscribing || notifPermission === "denied"}
              >
                {subscribing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : notifPermission === "granted" ? (
                  <><BellOff className="w-4 h-4" />Disable</>
                ) : (
                  <><Bell className="w-4 h-4" />Enable</>
                )}
              </Button>
            </div>
          )}
          {notifPermission === "denied" && (
            <p className="text-xs text-red-500 dark:text-red-400 mt-2">
              Notifications are blocked. Please allow them in your browser settings.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Change Password
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>New Password</Label>
            <Input type="password" placeholder="Minimum 6 characters" value={passwords.new} onChange={(e) => setPasswords({ ...passwords, new: e.target.value })} className="rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label>Confirm New Password</Label>
            <Input type="password" placeholder="Re-enter new password" value={passwords.confirm} onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })} className="rounded-xl" />
          </div>
          <Button onClick={handleChangePassword} disabled={changingPassword || !passwords.new || !passwords.confirm} className="w-full gap-2 rounded-xl">
            {changingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            Change Password
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
