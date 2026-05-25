"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GraduationCap, Eye, EyeOff, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
      // Pass class_id in metadata so trigger can use it
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
        // Wait a moment for the trigger to create the profile
        await new Promise((r) => setTimeout(r, 800));

        // Update profile with class_id (trigger may not have class_id)
        const { error: updateError } = await supabase
          .from("users")
          .update({ name: form.name, class_id: form.class_id, role: "student" })
          .eq("id", authData.user.id);

        if (updateError) {
          // Trigger hasn't run yet or failed — upsert manually
          const { error: upsertError } = await supabase.from("users").upsert({
            id: authData.user.id,
            name: form.name,
            email: form.email,
            class_id: form.class_id,
            role: "student",
          }, { onConflict: "id" });

          if (upsertError) {
            console.error("Profile upsert error:", upsertError);
            // Still proceed — profile will be created on next login
          }
        }

        toast.success("Account created! Welcome 🎉");
        router.push("/dashboard");
        router.refresh();
      } else {
        // Email confirmation required
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

  const gradeXI = classes.filter((c) => c.grade === "XI");
  const gradeXII = classes.filter((c) => c.grade === "XII");

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 flex flex-col">
      {/* Back button */}
      <div className="p-4">
        <Link href="/">
          <Button variant="ghost" size="sm" className="text-white hover:bg-white/20 gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 pb-8">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl">
              <GraduationCap className="w-9 h-9 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Create Account</h1>
            <p className="text-blue-200 text-sm mt-1">Join English LMS today</p>
          </div>

          {/* Card */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-6">
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Full Name</Label>
                <Input
                  placeholder="Enter your full name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  disabled={loading}
                  className="h-12 rounded-xl border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Email</Label>
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  disabled={loading}
                  className="h-12 rounded-xl border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Class</Label>
                <Select value={form.class_id} onValueChange={(v) => setForm({ ...form, class_id: v })} disabled={loading}>
                  <SelectTrigger className="h-12 rounded-xl border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                    <SelectValue placeholder="Select your class" />
                  </SelectTrigger>
                  <SelectContent>
                    {gradeXI.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Grade XI</div>
                        {gradeXI.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>{cls.class_name}</SelectItem>
                        ))}
                      </>
                    )}
                    {gradeXII.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Grade XII</div>
                        {gradeXII.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>{cls.class_name}</SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Password</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Minimum 6 characters"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    disabled={loading}
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

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Confirm Password</Label>
                <Input
                  type="password"
                  placeholder="Re-enter your password"
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                  disabled={loading}
                  className="h-12 rounded-xl border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base font-semibold rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg mt-2"
                disabled={loading}
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" />Creating account...</>
                ) : "Create Account"}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-800 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Already have an account?{" "}
                <Link href="/login" className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">
                  Sign In
                </Link>
              </p>
            </div>
          </div>

          <p className="text-center text-xs text-blue-200 mt-6">
            © 2026 English LMS — Agus Supriyono, S.Pd.,MM
          </p>
        </div>
      </div>
    </div>
  );
}
