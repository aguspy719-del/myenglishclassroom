"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User as UserIcon, Mail, Shield, Loader2, Save, Bell, BellOff, Globe, Flame, Camera, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { getInitials, formatDate } from "@/lib/utils";
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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialUser.avatar_url || null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const router = useRouter();

  // Teacher landing profile
  const [teacherProfile, setTeacherProfile] = useState({
    bio: (initialUser as any).bio || "",
    tagline: (initialUser as any).tagline || "",
    certifications: ((initialUser as any).certifications || ["English", "TOEFL Certified", "10+ Years"]).join(", "),
    years_experience: (initialUser as any).years_experience || 0,
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // Schedule
  const [schedules, setSchedules] = useState<any[]>([]);
  const [savingSchedule, setSavingSchedule] = useState(false);

  useEffect(() => {
    if (initialUser.role === "teacher") {
      const fetchSchedules = async () => {
        const supabase = createClient();
        const { data } = await supabase.from("schedules").select("*").order("sort_order");
        setSchedules(data || []);
      };
      fetchSchedules();
    }
  }, [initialUser.role]);

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

  const loginStreak = (user as any).login_streak || 0;

  const handleSaveName = async () => {
    if (!name.trim()) { toast.error("Name cannot be empty"); return; }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("users").update({ name }).eq("id", user.id);
    if (error) toast.error("Failed to save name");
    else { toast.success("Name updated!"); setUser({ ...user, name }); }
    setSaving(false);
  };

  // ── Avatar: upload ke Cloudinary via API (file fisik TIDAK di Supabase) ──
  const handleAvatarSelect = async (file: File | undefined) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Format harus JPG, PNG, atau WebP");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ukuran maksimal 5MB");
      return;
    }
    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/profile/avatar", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengupload foto");
      setAvatarUrl(data.avatar_url);
      setUser((u) => ({ ...u, avatar_url: data.avatar_url }));
      toast.success("Foto profil diperbarui!");
      router.refresh(); // refresh layout agar avatar di header ikut berubah
    } catch (e: any) {
      toast.error(e.message || "Gagal mengupload foto");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setUploadingAvatar(true);
    try {
      const res = await fetch("/api/profile/avatar", { method: "DELETE" });
      if (!res.ok) throw new Error("Gagal menghapus foto");
      setAvatarUrl(null);
      setUser((u) => ({ ...u, avatar_url: undefined }));
      toast.success("Foto profil dihapus");
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || "Gagal menghapus foto");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveTeacherProfile = async () => {
    setSavingProfile(true);
    const supabase = createClient();
    const certs = teacherProfile.certifications
      .split(",")
      .map((c: string) => c.trim())
      .filter(Boolean);
    const { error } = await supabase.from("users").update({
      bio: teacherProfile.bio || null,
      tagline: teacherProfile.tagline || null,
      certifications: certs,
      years_experience: Number(teacherProfile.years_experience) || 0,
    }).eq("id", user.id);
    if (error) toast.error("Failed to save profile");
    else toast.success("Landing page profile updated! ✅");
    setSavingProfile(false);
  };

  const handleScheduleChange = (idx: number, field: string, value: string) => {
    setSchedules((prev) => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  const handleAddSchedule = () => {
    setSchedules((prev) => [...prev, { id: null, day: "Monday", time: "07:30 - 09:00", class_name: "", sort_order: prev.length + 1 }]);
  };

  const handleDeleteSchedule = async (idx: number, id: string | null) => {
    if (id) {
      const supabase = createClient();
      await supabase.from("schedules").delete().eq("id", id);
    }
    setSchedules((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveSchedules = async () => {
    setSavingSchedule(true);
    const supabase = createClient();
    try {
      for (let i = 0; i < schedules.length; i++) {
        const s = schedules[i];
        if (s.id) {
          await supabase.from("schedules").update({ day: s.day, time: s.time, class_name: s.class_name, sort_order: i + 1 }).eq("id", s.id);
        } else {
          const { data } = await supabase.from("schedules").insert({ day: s.day, time: s.time, class_name: s.class_name, sort_order: i + 1 }).select().single();
          if (data) setSchedules((prev) => prev.map((item, idx) => idx === i ? data : item));
        }
      }
      toast.success("Schedule updated! ✅");
    } catch {
      toast.error("Failed to save schedule");
    }
    setSavingSchedule(false);
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
        <p className="text-gray-500 dark:text-gray-400 mt-1">Kelola akun dan lihat streak login kamu</p>
      </div>

      {/* Profile Hero Card */}
      <Card className="border-0 shadow-sm overflow-hidden">
        {/* Banner */}
        <div className="h-28 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700" />
        {/* Content */}
        <CardContent className="pt-0 pb-6 px-5">
          {/* Avatar with upload & remove */}
          <div className="-mt-12 mb-3 flex flex-col items-center">
            <div className="relative">
              <Avatar className="w-24 h-24 border-4 border-white dark:border-gray-900 shadow-xl">
                {avatarUrl && <AvatarImage src={avatarUrl} alt={user.name} className="object-cover" />}
                <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-2xl font-bold">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              {/* Upload / replace photo */}
              <label
                className={`absolute bottom-0 right-0 w-8 h-8 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-lg ring-2 ring-white dark:ring-gray-900 cursor-pointer transition-colors ${uploadingAvatar ? "opacity-60 pointer-events-none" : ""}`}
                title={avatarUrl ? "Ganti foto" : "Tambah foto"}
              >
                {uploadingAvatar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  disabled={uploadingAvatar}
                  onChange={(e) => {
                    handleAvatarSelect(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
              {/* Remove photo (only when one exists) */}
              {avatarUrl && !uploadingAvatar && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  title="Hapus foto"
                  className="absolute bottom-0 left-0 w-8 h-8 rounded-full bg-white dark:bg-gray-800 text-red-500 hover:text-red-600 flex items-center justify-center shadow-lg ring-2 ring-white dark:ring-gray-900 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          {/* Nama, email, badge — centered, professional */}
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{user.name}</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">{user.email}</p>
            <Badge className={`mt-2 ${user.role === "teacher"
              ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"}`}>
              {user.role === "teacher" ? "Teacher" : "Student"}
            </Badge>
          </div>

          {/* Login streak — students only (replaces XP/Level/Badges) */}
          {user.role === "student" && (
            <div className="mt-4 p-4 bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl text-white">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
                  <Flame className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold">Streak login {loginStreak} hari</p>
                  <p className="text-xs text-orange-100">Masuk tiap hari agar streak tetap hidup</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-3">
                {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                  <div
                    key={day}
                    className={`h-2 flex-1 rounded-full ${day <= Math.min(loginStreak, 7) ? "bg-white" : "bg-white/25"}`}
                  />
                ))}
              </div>
              <p className="text-[11px] text-orange-100 mt-2">
                {loginStreak >= 7 ? "Streak 7 hari tercapai — lanjut ke 30!" : `${7 - loginStreak} hari lagi ke streak 7 hari`}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

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

      {/* Teacher Landing Page Profile */}
      {user.role === "teacher" && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-600" />
              Landing Page Profile
            </CardTitle>
            <p className="text-xs text-gray-500 dark:text-gray-400">Tampil di halaman utama website</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Bio / Jabatan</Label>
              <Input
                placeholder="English Teacher · SMK Negeri 1 Buduran"
                value={teacherProfile.bio}
                onChange={(e) => setTeacherProfile({ ...teacherProfile, bio: e.target.value })}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Tagline / Quote (opsional)</Label>
              <Input
                placeholder="Inspiring students to love English"
                value={teacherProfile.tagline}
                onChange={(e) => setTeacherProfile({ ...teacherProfile, tagline: e.target.value })}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Sertifikasi / Badge</Label>
              <Input
                placeholder="English, TOEFL Certified, 10+ Years"
                value={teacherProfile.certifications}
                onChange={(e) => setTeacherProfile({ ...teacherProfile, certifications: e.target.value })}
                className="rounded-xl"
              />
              <p className="text-xs text-gray-400">Pisahkan dengan koma</p>
            </div>
            <div className="space-y-2">
              <Label>Pengalaman Mengajar (tahun)</Label>
              <Input
                type="number"
                min={0}
                placeholder="10"
                value={teacherProfile.years_experience}
                onChange={(e) => setTeacherProfile({ ...teacherProfile, years_experience: Number(e.target.value) })}
                className="rounded-xl w-32"
              />
            </div>
            <Button
              onClick={handleSaveTeacherProfile}
              disabled={savingProfile}
              className="gap-2 rounded-xl"
            >
              {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Simpan Profile Landing Page
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Edit Schedule */}
      {user.role === "teacher" && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="w-4 h-4 text-indigo-600" />
                  Jadwal Mengajar
                </CardTitle>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Tampil di landing page</p>
              </div>
              <Button size="sm" variant="outline" onClick={handleAddSchedule} className="gap-1 rounded-xl text-xs">
                + Tambah
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {schedules.map((s, idx) => (
              <div key={idx} className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <div className="grid grid-cols-3 gap-2 flex-1">
                  <Input
                    placeholder="Hari"
                    value={s.day}
                    onChange={(e) => handleScheduleChange(idx, "day", e.target.value)}
                    className="rounded-xl h-9 text-xs"
                  />
                  <Input
                    placeholder="07:30 - 09:00"
                    value={s.time}
                    onChange={(e) => handleScheduleChange(idx, "time", e.target.value)}
                    className="rounded-xl h-9 text-xs"
                  />
                  <Input
                    placeholder="Kelas"
                    value={s.class_name}
                    onChange={(e) => handleScheduleChange(idx, "class_name", e.target.value)}
                    className="rounded-xl h-9 text-xs"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-500 hover:bg-red-50 flex-shrink-0"
                  onClick={() => handleDeleteSchedule(idx, s.id)}
                >
                  <span className="text-sm">✕</span>
                </Button>
              </div>
            ))}
            {schedules.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">Belum ada jadwal. Klik &quot;+ Tambah&quot;</p>
            )}
            <Button
              onClick={handleSaveSchedules}
              disabled={savingSchedule}
              className="gap-2 rounded-xl w-full"
            >
              {savingSchedule ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Simpan Jadwal
            </Button>
          </CardContent>
        </Card>
      )}

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
