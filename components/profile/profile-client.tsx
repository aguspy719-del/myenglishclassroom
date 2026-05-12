"use client";

import { useState } from "react";
import { User as UserIcon, Mail, Shield, Loader2, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { getInitials, formatDate } from "@/lib/utils";
import type { User } from "@/types";

interface ProfileClientProps {
  user: User;
}

export function ProfileClient({ user }: ProfileClientProps) {
  const [name, setName] = useState(user.name);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwords, setPasswords] = useState({ current: "", new: "", confirm: "" });

  const handleSaveName = async () => {
    if (!name.trim()) {
      toast.error("Nama tidak boleh kosong");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("users").update({ name }).eq("id", user.id);
    if (error) {
      toast.error("Gagal menyimpan nama");
    } else {
      toast.success("Nama berhasil diperbarui");
    }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (!passwords.new || !passwords.confirm) {
      toast.error("Password baru harus diisi");
      return;
    }
    if (passwords.new !== passwords.confirm) {
      toast.error("Konfirmasi password tidak cocok");
      return;
    }
    if (passwords.new.length < 6) {
      toast.error("Password minimal 6 karakter");
      return;
    }

    setChangingPassword(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: passwords.new });

    if (error) {
      toast.error("Gagal mengubah password: " + error.message);
    } else {
      toast.success("Password berhasil diubah");
      setPasswords({ current: "", new: "", confirm: "" });
    }
    setChangingPassword(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Profil Saya</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Kelola informasi akun kamu</p>
      </div>

      {/* Profile Card */}
      <Card>
        <CardContent className="pt-6 pb-6">
          <div className="flex items-center gap-4 mb-6">
            <Avatar className="w-20 h-20">
              <AvatarImage src={user.avatar_url} />
              <AvatarFallback className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-2xl font-bold">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{user.name}</h2>
              <p className="text-gray-500 dark:text-gray-400">{user.email}</p>
              <Badge
                variant={user.role === "teacher" ? "info" : "success"}
                className="mt-1"
              >
                {user.role === "teacher" ? "👨‍🏫 Guru" : "👨‍🎓 Siswa"}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Bergabung</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(user.created_at)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Role</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">{user.role}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Name */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <UserIcon className="w-4 h-4" />
            Ubah Nama
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama lengkap"
              className="flex-1"
            />
            <Button onClick={handleSaveName} disabled={saving || name === user.name} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Simpan
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Account Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Informasi Akun
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Email</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{user.email}</p>
            </div>
            <Badge variant="success" className="text-xs">Terverifikasi</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Ubah Password
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Password Baru</Label>
            <Input
              type="password"
              placeholder="Minimal 6 karakter"
              value={passwords.new}
              onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Konfirmasi Password Baru</Label>
            <Input
              type="password"
              placeholder="Ulangi password baru"
              value={passwords.confirm}
              onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
            />
          </div>
          <Button
            onClick={handleChangePassword}
            disabled={changingPassword || !passwords.new || !passwords.confirm}
            className="w-full gap-2"
          >
            {changingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            Ubah Password
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
