"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GraduationCap, Eye, EyeOff, Loader2, ArrowLeft } from "lucide-react";
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
        toast.error(error.message.includes("Invalid login credentials") ? "Incorrect email or password" : error.message);
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
    <div className="min-h-screen bg-gradient-to-br from-green-800 via-green-700 to-green-600 flex flex-col">
      {/* Back button */}
      <div className="p-4">
        <Link href="/">
          <Button variant="ghost" size="sm" className="text-white hover:bg-white/20 gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl">
              <GraduationCap className="w-9 h-9 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">My Classroom</h1>
            <p className="text-green-200 text-sm mt-1">SMK Negeri 1 Buduran</p>
          </div>

          {/* Card */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Sign In</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Welcome back! Enter your credentials.
            </p>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  autoComplete="email"
                  className="h-12 rounded-xl border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    autoComplete="current-password"
                    className="h-12 rounded-xl border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base font-semibold rounded-xl bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-lg"
                disabled={loading}
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" />Signing in...</>
                ) : "Sign In"}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-800 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Don&apos;t have an account?{" "}
                <Link href="/register" className="text-green-600 dark:text-green-400 font-semibold hover:underline">
                  Register here
                </Link>
              </p>
            </div>
          </div>

          <p className="text-center text-xs text-green-200 mt-6">
            © 2026 My Classroom — Agus Supriyono, S.Pd.,MM
          </p>
        </div>
      </div>
    </div>
  );
}
