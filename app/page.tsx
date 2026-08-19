import Link from "next/link";
import {
  BookOpen, GraduationCap, Users, ClipboardList,
  Star, Bell, ArrowRight, Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";

const classColors = [
  "from-blue-500 to-blue-600",
  "from-indigo-500 to-indigo-600",
  "from-violet-500 to-violet-600",
  "from-purple-500 to-purple-600",
  "from-cyan-500 to-cyan-600",
  "from-teal-500 to-teal-600",
  "from-emerald-500 to-emerald-600",
  "from-green-500 to-green-600",
];

const announcements = [
  {
    title: "Speaking Assignment Submission",
    content: "The speaking assignment for class XI Butik 1 must be submitted no later than Friday, May 16, 2026.",
    date: "May 10, 2026",
    type: "deadline",
  },
  {
    title: "AKM Quiz Next Week",
    content: "An AKM quiz will be held for all Grade XI classes next week. Study the Hope & Plan material.",
    date: "May 8, 2026",
    type: "info",
  },
  {
    title: "New Material Available",
    content: "Meeting 4 material for the Daily Activities topic has been uploaded. Please download it.",
    date: "May 5, 2026",
    type: "material",
  },
];

const features = [
  { icon: BookOpen, title: "Digital Materials", desc: "Access learning materials anytime, anywhere", color: "bg-blue-500", light: "bg-blue-50 dark:bg-blue-950" },
  { icon: ClipboardList, title: "Online Assignments", desc: "Submit assignments digitally with ease", color: "bg-purple-500", light: "bg-purple-50 dark:bg-purple-950" },
  { icon: Star, title: "Transparent Grades", desc: "View grades and feedback instantly", color: "bg-yellow-500", light: "bg-yellow-50 dark:bg-yellow-950" },
  { icon: Users, title: "Digital Attendance", desc: "Modern attendance tracking system", color: "bg-green-500", light: "bg-green-50 dark:bg-green-950" },
  { icon: Award, title: "Assessments", desc: "Quizzes & tests with instant results", color: "bg-red-500", light: "bg-red-50 dark:bg-red-950" },
];

export default async function LandingPage() {
  const supabase = createClient();
  const [{ data: classes }, { data: countData }, { data: teacherData }, { data: scheduleData }] = await Promise.all([
    supabase.from("classes").select("*").order("grade").order("class_name"),
    supabase.rpc("get_student_count"),
    supabase.from("users").select("name, avatar_url, bio, tagline, certifications, years_experience").eq("role", "teacher").single(),
    supabase.from("schedules").select("*").order("sort_order"),
  ]);

  const totalStudents = (countData as number) || 0;
  const teacher = teacherData as any || {
    name: "Agus Supriyono, S.Pd.,MM",
    avatar_url: null,
    bio: "English Teacher · SMK Negeri 1 Buduran",
    tagline: null,
    certifications: ["English", "TOEFL Certified", "10+ Years"],
    years_experience: 10,
  };
  const schedules = (scheduleData as any[]) || [];

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 glass bg-white/80 dark:bg-gray-950/80 border-b border-gray-200/50 dark:border-gray-800/50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-gray-900 dark:text-white leading-none">My Classroom</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">SMK Negeri 1 Buduran</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/register">
              <Button variant="ghost" size="sm" className="hidden sm:flex">Register</Button>
            </Link>
            <Link href="/login">
              <Button size="sm" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md">
                Login
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 py-20 px-4">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-6xl mx-auto text-center text-white">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 mb-6 text-sm font-medium">
            <span className="w-2 h-2 bg-green-400 rounded-full pulse-soft" />
            SMK Negeri 1 Buduran · English Subject
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 leading-tight">
            Welcome to
            <br />
            <span className="text-yellow-300">My Classroom</span>
            <br />
            with Mr. Agus
          </h1>
          <p className="text-lg sm:text-xl text-blue-100 mb-8 max-w-2xl mx-auto leading-relaxed">
            Your digital English classroom. Access materials, submit assignments, and track your progress — all in one place.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register">
              <Button size="lg" className="w-full sm:w-auto bg-white text-blue-600 hover:bg-blue-50 font-bold shadow-xl gap-2 text-base px-8 h-12">
                Get Started Free <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" className="w-full sm:w-auto bg-white/20 backdrop-blur-sm border-2 border-white text-white hover:bg-white hover:text-blue-600 font-semibold text-base px-8 h-12">
                Sign In
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto mt-12">
            {[
              { value: String(classes?.length || 8), label: "Classes" },
              { value: String(totalStudents), label: "Students" },
              { value: "100%", label: "Digital" },
            ].map((stat) => (
              <div key={stat.label} className="bg-white/10 backdrop-blur-sm rounded-2xl p-4">
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-xs text-blue-200">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-16 px-4 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <Badge variant="info" className="mb-3">Features</Badge>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">Everything You Need</h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">All tools for learning English in one platform</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.title} className="border-0 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1">
                  <CardContent className="pt-6 pb-6 text-center">
                    <div className={`w-14 h-14 ${feature.light} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
                      <div className={`w-8 h-8 ${feature.color} rounded-xl flex items-center justify-center`}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-white mb-1 text-sm">{feature.title}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{feature.desc}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Teacher Profile */}
      <section className="py-16 px-4 bg-white dark:bg-gray-950">
        <div className="max-w-6xl mx-auto">
          <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-3xl p-6 sm:p-8 text-white">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32 blur-2xl" />
            <div className="relative flex flex-col sm:flex-row items-center gap-6">
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-xl overflow-hidden">
                {teacher.avatar_url ? (
                  <img src={teacher.avatar_url} alt={teacher.name} className="w-full h-full object-cover" />
                ) : (
                  <GraduationCap className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
                )}
              </div>
              <div className="text-center sm:text-left flex-1">
                <p className="text-blue-200 text-sm font-medium mb-1">Your English Teacher</p>
                <h2 className="text-2xl sm:text-3xl font-bold mb-1">{teacher.name}</h2>
                <p className="text-blue-100 mb-3">{teacher.bio || "English Teacher · SMK Negeri 1 Buduran"}</p>
                {teacher.tagline && (
                  <p className="text-yellow-300 text-sm italic mb-3">"{teacher.tagline}"</p>
                )}
                <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                  {(teacher.certifications || ["English", "TOEFL Certified", "10+ Years"]).map((cert: string) => (
                    <span key={cert} className="bg-white/20 text-white text-xs px-3 py-1 rounded-full">{cert}</span>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 flex-shrink-0">
                <div className="bg-white/15 rounded-2xl p-4 text-center">
                  <p className="text-3xl font-bold">{classes?.length || 8}</p>
                  <p className="text-xs text-blue-200">Classes</p>
                </div>
                <div className="bg-white/15 rounded-2xl p-4 text-center">
                  <p className="text-3xl font-bold">{totalStudents}</p>
                  <p className="text-xs text-blue-200">Students</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Classes - Dynamic from DB */}
      <section className="py-16 px-4 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <Badge variant="info" className="mb-3">Classes</Badge>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">Classes Taught</h2>
            <p className="text-gray-500 dark:text-gray-400">Academic year 2025/2026</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(classes || []).map((cls, idx) => (
              <div
                key={cls.id}
                className={`bg-gradient-to-br ${classColors[idx % classColors.length]} rounded-2xl p-4 text-white shadow-md hover:shadow-lg hover:-translate-y-1 transition-all duration-200`}
              >
                <p className="font-bold text-lg leading-tight">{cls.class_name}</p>
                <p className="text-white/80 text-xs mt-1">{cls.major}</p>
                <div className="flex items-center gap-1 mt-3">
                  <Users className="w-3 h-3 text-white/70" />
                  <span className="text-xs text-white/80">Grade {cls.grade}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Schedule */}
      <section className="py-16 px-4 bg-white dark:bg-gray-950">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <Badge variant="info" className="mb-3">Schedule</Badge>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">Teaching Schedule</h2>
          </div>
          <div className="max-w-2xl mx-auto space-y-2">
            {schedules.map((item, idx) => (
              <div
                key={item.id || idx}
                className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-white">{item.day.substring(0, 3).toUpperCase()}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">{item.day}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{item.time}</p>
                  </div>
                </div>
                <Badge variant="info" className="text-xs">{item.class_name}</Badge>
              </div>
            ))}
            {schedules.length === 0 && (
              <p className="text-center text-gray-400 py-8">No schedule yet</p>
            )}
          </div>
        </div>
      </section>

      {/* Announcements */}
      <section className="py-16 px-4 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <Badge variant="info" className="mb-3">Announcements</Badge>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">Latest Updates</h2>
          </div>
          <div className="max-w-3xl mx-auto space-y-3">
            {announcements.map((ann) => (
              <div key={ann.title} className="flex gap-4 p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  ann.type === "deadline" ? "bg-red-100 dark:bg-red-900" :
                  ann.type === "material" ? "bg-green-100 dark:bg-green-900" :
                  "bg-blue-100 dark:bg-blue-900"
                }`}>
                  <Bell className={`w-5 h-5 ${
                    ann.type === "deadline" ? "text-red-600 dark:text-red-400" :
                    ann.type === "material" ? "text-green-600 dark:text-green-400" :
                    "text-blue-600 dark:text-blue-400"
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge variant={ann.type === "deadline" ? "destructive" : ann.type === "material" ? "success" : "info"} className="text-xs">
                      {ann.type === "deadline" ? "Deadline" : ann.type === "material" ? "Material" : "Info"}
                    </Badge>
                    <span className="text-xs text-gray-400">{ann.date}</span>
                  </div>
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">{ann.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">{ann.content}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-3xl mx-auto text-center text-white">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Award className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to Start Learning?</h2>
          <p className="text-blue-100 mb-8 text-lg">Join your classmates and access all English learning materials</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register">
              <Button size="lg" className="w-full sm:w-auto bg-white text-blue-600 hover:bg-blue-50 font-bold gap-2 px-8 h-12">
                Register Now <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" className="w-full sm:w-auto bg-white/20 backdrop-blur-sm border-2 border-white text-white hover:bg-white hover:text-blue-600 font-semibold px-8 h-12">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-950 text-gray-400 py-8 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2.5 mb-4">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white">My Classroom</span>
          </div>
          <p className="text-sm">© 2026 My Classroom — Agus Supriyono, S.Pd.,MM · SMK Negeri 1 Buduran</p>
          <p className="text-xs mt-2 text-gray-600">Built with ❤️ for better English education</p>
        </div>
      </footer>
    </div>
  );
}
