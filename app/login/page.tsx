"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Eye, EyeOff, Loader2, ArrowLeft, Mail, Lock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Email and password are required");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(
          error.message.includes("Invalid login credentials")
            ? "Incorrect email or password"
            : error.message
        );
        return;
      }
      if (data.user) {
        toast.success("Welcome back!");
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.1fr_1fr]">
      {/* ══ Branding panel — desktop only ══ */}
      <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white p-12 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-16 w-96 h-96 bg-teal-400/20 rounded-full blur-3xl pointer-events-none" />

        {/* Brand */}
        <div className="relative flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-xl bg-white/95 p-1">
            <Image src="/icons/icon-192.png" alt="My Classroom" width={48} height={48} className="w-full h-full object-cover" />
          </div>
          <div>
            <p className="text-lg font-black leading-tight">My Classroom</p>
            <p className="text-xs text-emerald-100">English Learning Management System</p>
          </div>
        </div>

        {/* Headline + features */}
        <div className="relative max-w-md">
          <h2 className="text-4xl font-black leading-tight">
            Belajar Bahasa Inggris,<br />lebih terstruktur.
          </h2>
          <p className="text-emerald-100 mt-4 leading-relaxed">
            Satu aplikasi untuk asesmen, tugas, kehadiran, dan nilai — dirancang
            untuk siswa dan guru SMK Negeri 1 Buduran.
          </p>
          <ul className="mt-8 space-y-3.5">
            {[
              "Asesmen & tugas online dengan anti-cheat",
              "Absensi cepat dengan verifikasi lokasi sekolah",
              "Nilai & rekap kehadiran transparan",
            ].map((text) => (
              <li key={text} className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-200 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-emerald-50">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-emerald-200/80">
          © 2026 My Classroom — Agus Supriyono, S.Pd., MM
        </p>
      </div>

      {/* ══ Form side ══ */}
      <div className="min-h-screen lg:min-h-0 bg-gradient-to-br from-emerald-50 via-teal-50 to-white flex flex-col relative">
        {/* Decorative circles — mobile only (desktop uses the branding panel) */}
        <div className="lg:hidden fixed top-20 -right-32 w-72 h-72 bg-emerald-200/40 rounded-full blur-3xl pointer-events-none" />
        <div className="lg:hidden fixed bottom-20 -left-32 w-72 h-72 bg-teal-200/40 rounded-full blur-3xl pointer-events-none" />

        {/* back button */}
        <div className="relative p-4">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900 hover:bg-white/50 gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </Link>
        </div>

        {/* center content */}
        <div className="relative flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-sm">

            {/* Logo — mobile only (desktop already has the brand panel) */}
            <div className="lg:hidden text-center mb-8">
              <div className="w-16 h-16 rounded-2xl overflow-hidden mx-auto mb-4 shadow-xl shadow-emerald-500/25">
                <Image src="/icons/icon-192.png" alt="My Classroom" width={64} height={64} className="w-full h-full object-cover" />
              </div>
              <h1 className="text-2xl font-black text-gray-900">My Classroom</h1>
              <p className="text-gray-500 text-sm mt-1">SMK Negeri 1 Buduran</p>
            </div>

            {/* Card */}
            <div className="relative bg-white border border-gray-200 rounded-3xl p-6 shadow-xl">
              <h2 className="text-xl font-black text-gray-900">Sign In</h2>
              <p className="text-sm text-gray-500 mb-6">
                Welcome back! Enter your credentials.
              </p>

              <form onSubmit={handleLogin} className="space-y-4">
                {/* Email */}
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-sm font-semibold text-gray-700">
                    Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                      autoComplete="email"
                      className="h-12 rounded-xl bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 pl-10 focus:border-emerald-500 focus:ring-emerald-500/20 focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-sm font-semibold text-gray-700">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      autoComplete="current-password"
                      className="h-12 rounded-xl bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 pl-10 pr-12 focus:border-emerald-500 focus:ring-emerald-500/20 focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors p-1"
                      tabIndex={-1}
                      aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                    >
                      {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                    </button>
                  </div>
                </div>

                {/* Submit */}
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 text-base font-bold rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-500/25 text-white mt-2 transition-all duration-200"
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" />Signing in...</>
                  ) : "Sign In"}
                </Button>
              </form>

              <div className="mt-6 pt-5 border-t border-gray-100 text-center">
                <p className="text-sm text-gray-500">
                  Don&apos;t have an account?{" "}
                  <Link href="/register" className="text-emerald-600 font-bold hover:text-emerald-700 transition-colors">
                    Register here
                  </Link>
                </p>
              </div>
            </div>

            <p className="text-center text-xs text-gray-400 mt-6 lg:hidden">
              © 2026 My Classroom — Agus Supriyono, S.Pd.,MM
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
