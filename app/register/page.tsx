"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Eye, EyeOff, Loader2, ArrowLeft, Mail, Lock, User, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  SelectGroup, SelectLabel,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface Class {
  id: string;
  class_name: string;
  grade: string;
  major: string;
}

export default function RegisterPage() {
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "", class_id: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<Class[]>([]);
  const router = useRouter();

  useEffect(() => {
    const fetchClasses = async () => {
      const supabase = createClient();
      const { data } = await supabase.from("classes").select("*").order("grade").order("class_name");
      setClasses(data || []);
    };
    fetchClasses();
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password || !form.class_id) {
      toast.error("All fields are required");
      return;
    }
    if (form.password !== form.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (form.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: { name: form.name, role: "student", class_id: form.class_id },
        },
      });

      if (authError) {
        toast.error(
          authError.message.includes("already registered")
            ? "This email is already registered. Please sign in instead."
            : authError.message
        );
        return;
      }

      if (authData.user) {
        await new Promise((r) => setTimeout(r, 800));

        const { error: updateError } = await supabase
          .from("users")
          .update({ name: form.name, class_id: form.class_id, role: "student" })
          .eq("id", authData.user.id);

        if (updateError) {
          const { error: upsertError } = await supabase.from("users").upsert({
            id: authData.user.id,
            name: form.name,
            email: form.email,
            class_id: form.class_id,
            role: "student",
          }, { onConflict: "id" });

          if (upsertError) {
            console.error("Profile upsert error:", upsertError);
          }
        }

        toast.success("Account created! Welcome");
        router.push("/dashboard");
        router.refresh();
      } else {
        toast.success("Account created! Please check your email to confirm, then sign in.");
        router.push("/login");
      }
    } catch (err: any) {
      console.error("Register error:", err);
      toast.error("Something went wrong: " + (err.message || "Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const gradeXI  = classes.filter((c) => c.grade === "XI");
  const gradeXII = classes.filter((c) => c.grade === "XII");

  const inputClass = "h-12 rounded-xl bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:ring-emerald-500/20 focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500";

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

        <p className="relative text-xs text-emerald-200/80">
          © 2026 My Classroom — Agus Supriyono, S.Pd., MM
        </p>
      </div>

      {/* ══ Form side ══ */}
      <div className="min-h-screen lg:min-h-0 bg-gradient-to-br from-emerald-50 via-teal-50 to-white flex flex-col relative">
        {/* Decorative circles — mobile only */}
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
        <div className="relative flex-1 flex items-center justify-center p-4 pb-8">
          <div className="w-full max-w-sm">

            {/* Logo — mobile only */}
            <div className="lg:hidden text-center mb-6">
              <div className="w-16 h-16 rounded-2xl overflow-hidden mx-auto mb-4 shadow-xl shadow-emerald-500/25">
                <Image src="/icons/icon-192.png" alt="My Classroom" width={64} height={64} className="w-full h-full object-cover" />
              </div>
              <h1 className="text-2xl font-black text-gray-900">Create Account</h1>
              <p className="text-gray-500 text-sm mt-1">Join My Classroom today</p>
            </div>

            {/* Card */}
            <div className="relative bg-white border border-gray-200 rounded-3xl p-6 shadow-xl">
              <h2 className="text-xl font-black text-gray-900">Register</h2>
              <p className="text-sm text-gray-500 mb-5">
                Fill in your details to get started.
              </p>

              <form onSubmit={handleRegister} className="space-y-4">
                {/* Full Name */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold text-gray-700">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <Input
                      placeholder="Enter your full name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      disabled={loading}
                      autoComplete="name"
                      className={`${inputClass} pl-10`}
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold text-gray-700">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <Input
                      type="email"
                      placeholder="your@email.com"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      disabled={loading}
                      autoComplete="email"
                      className={`${inputClass} pl-10`}
                    />
                  </div>
                </div>

                {/* Class */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold text-gray-700">Class</Label>
                  <Select
                    value={form.class_id}
                    onValueChange={(v) => setForm({ ...form, class_id: v })}
                    disabled={loading}
                  >
                    <SelectTrigger className={`h-12 rounded-xl bg-gray-50 border-gray-200 text-gray-900 data-[placeholder]:text-gray-400 focus:border-emerald-500 focus:ring-emerald-500/20`}>
                      <GraduationCap className="w-4 h-4 text-gray-400 mr-1 flex-shrink-0" />
                      <SelectValue placeholder="Select your class" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-200">
                      {gradeXI.length > 0 && (
                        <SelectGroup>
                          <SelectLabel className="text-gray-500 text-xs">Grade XI</SelectLabel>
                          {gradeXI.map((cls) => (
                            <SelectItem
                              key={cls.id}
                              value={cls.id}
                              className="text-gray-900 focus:bg-emerald-50 focus:text-emerald-900"
                            >
                              {cls.class_name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                      {gradeXII.length > 0 && (
                        <SelectGroup>
                          <SelectLabel className="text-gray-500 text-xs">Grade XII</SelectLabel>
                          {gradeXII.map((cls) => (
                            <SelectItem
                              key={cls.id}
                              value={cls.id}
                              className="text-gray-900 focus:bg-emerald-50 focus:text-emerald-900"
                            >
                              {cls.class_name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold text-gray-700">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Minimum 6 characters"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      disabled={loading}
                      autoComplete="new-password"
                      className={`${inputClass} pl-10 pr-12`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors p-1"
                      tabIndex={-1}
                      aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold text-gray-700">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <Input
                      type="password"
                      placeholder="Re-enter your password"
                      value={form.confirmPassword}
                      onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                      disabled={loading}
                      autoComplete="new-password"
                      className={`${inputClass} pl-10`}
                    />
                  </div>
                </div>

                {/* Submit */}
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 text-base font-bold rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-500/25 text-white mt-2 transition-all duration-200"
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" />Creating account...</>
                  ) : "Create Account"}
                </Button>
              </form>

              <div className="mt-6 pt-5 border-t border-gray-100 text-center">
                <p className="text-sm text-gray-500">
                  Already have an account?{" "}
                  <Link href="/login" className="text-emerald-600 font-bold hover:text-emerald-700 transition-colors">
                    Sign In
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
