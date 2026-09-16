"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Eye, EyeOff, Loader2, ArrowLeft, Sparkles } from "lucide-react";
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
        toast.success("Welcome back! 👋");
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
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-white flex flex-col">
      {/* Decorative circles */}
      <div className="fixed top-20 -right-32 w-72 h-72 bg-emerald-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-20 -left-32 w-72 h-72 bg-teal-200/40 rounded-full blur-3xl pointer-events-none" />

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

          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl overflow-hidden mx-auto mb-4 shadow-xl shadow-emerald-500/25">
              <Image src="/icons/icon-192.png" alt="My Classroom" width={64} height={64} className="w-full h-full object-cover" />
            </div>
            <h1 className="text-2xl font-black text-gray-900">My Classroom</h1>
            <p className="text-gray-500 text-sm mt-1">SMK Negeri 1 Buduran</p>
          </div>

          {/* Card */}
          <div className="relative bg-white border border-gray-200 rounded-3xl p-6 shadow-xl">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-black text-gray-900">Sign In</h2>
              <Sparkles className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-sm text-gray-500 mb-6">
              Welcome back! Enter your credentials.
            </p>

            <form onSubmit={handleLogin} className="space-y-4">
              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-semibold text-gray-700">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  autoComplete="email"
                  className="h-12 rounded-xl bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:ring-emerald-500/20 focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500"
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-semibold text-gray-700">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    autoComplete="current-password"
                    className="h-12 rounded-xl bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 pr-12 focus:border-emerald-500 focus:ring-emerald-500/20 focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors p-1"
                    tabIndex={-1}
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

          <p className="text-center text-xs text-gray-400 mt-6">
            © 2026 My Classroom — Agus Supriyono, S.Pd.,MM
          </p>
        </div>
      </div>
    </div>
  );
}
