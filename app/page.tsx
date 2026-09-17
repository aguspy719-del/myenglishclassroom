import Link from "next/link";
import Image from "next/image";
import {
  BookOpen, Users, ClipboardList,
  Star, Bell, ArrowRight, Award, CheckCircle2,
  MapPin, Calendar, Sparkles, FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createServiceClient } from "@/lib/supabase/server";
import { Reveal, CountUp, FloatingBlob } from "@/components/landing-motion";

const features = [
  { icon: BookOpen,     title: "Digital Materials",   desc: "Access learning materials anytime, anywhere",    color: "from-emerald-500 to-emerald-700" },
  { icon: ClipboardList, title: "Online Assignments",  desc: "Submit assignments digitally with ease",          color: "from-teal-500 to-teal-700" },
  { icon: Star,         title: "Transparent Grades",  desc: "View grades and feedback instantly",              color: "from-green-500 to-green-700" },
  { icon: Users,        title: "Digital Attendance",  desc: "GPS-verified modern attendance system",           color: "from-cyan-500 to-cyan-700" },
  { icon: Award,        title: "Assessments",         desc: "Quizzes & tests with instant results",            color: "from-lime-500 to-lime-700" },
  { icon: FileSpreadsheet, title: "Grade Recap",      desc: "Export full report cards to Excel instantly",     color: "from-teal-600 to-emerald-800" },
];

export default async function LandingPage() {
  const supabase = createServiceClient();
  const [{ data: classes }, { count: studentCount }, { data: teacherData }, { data: scheduleData }, { data: announcementData }] = await Promise.all([
    supabase.from("classes").select("*").order("grade").order("class_name"),
    supabase.from("users").select("*", { count: "exact", head: true }).eq("role", "student"),
    supabase.from("users").select("name, avatar_url, bio, tagline, certifications, years_experience").eq("role", "teacher").single(),
    supabase.from("schedules").select("*").order("sort_order"),
    supabase.from("announcements").select("*").order("created_at", { ascending: false }).limit(3),
  ]);

  // Latest announcements from the database, falling back to defaults
  const announcements = ((announcementData as any[]) || []).map((a) => ({
    title: a.title as string,
    content: a.content as string,
    date: new Date(a.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    type: "info",
  }));

  const totalStudents = studentCount ?? 0;
  const teacher = teacherData as any || {
    name: "Agus Supriyono, S.Pd.,MM",
    avatar_url: null,
    bio: "English Teacher · SMK Negeri 1 Buduran",
    tagline: null,
    certifications: ["English", "TOEFL Certified", "10+ Years"],
    years_experience: 10,
  };
  const schedules = (scheduleData as any[]) || [];
  const allClasses = classes || [];

  // Pastikan allClasses tidak kosong untuk marquee
  const hasClasses = allClasses.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-emerald-50/30 to-white bg-texture">

      {/* ── NAVBAR ── */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl overflow-hidden shadow-lg shadow-emerald-500/25">
              <Image src="/icons/icon-192.png" alt="My Classroom" width={36} height={36} className="w-full h-full object-cover" />
            </div>
            <div className="leading-none">
              <p className="font-bold text-gray-900 text-sm">My Classroom</p>
              <p className="text-[11px] text-gray-500">SMK Negeri 1 Buduran</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/register">
              <Button variant="ghost" size="sm" className="hidden sm:flex text-gray-600 hover:text-gray-900">
                Register
              </Button>
            </Link>
            <Link href="/login">
              <Button size="sm" className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-md shadow-emerald-500/20 text-white font-semibold">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative py-16 sm:py-20 px-4 overflow-hidden">
        {/* Decorative circles + gently floating blobs */}
        <div className="absolute top-20 -right-32 w-64 h-64 bg-emerald-200/40 rounded-full blur-3xl" />
        <div className="absolute bottom-20 -left-32 w-64 h-64 bg-teal-200/40 rounded-full blur-3xl" />
        <FloatingBlob className="bg-emerald-300/25 w-72 h-72 -top-8 right-10" style={{ animationDelay: "-2s" }} />
        <FloatingBlob className="bg-teal-300/25 w-80 h-80 -bottom-20 left-6" style={{ animationDelay: "-5s", animationDuration: "11s" }} />

        <div className="relative max-w-6xl mx-auto grid lg:grid-cols-[1.15fr_1fr] gap-10 lg:gap-14 items-center">
          {/* Left: headline + CTA + stats */}
          <div className="text-center lg:text-left">
            <div className="relative inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-full px-4 py-2 mb-6 text-sm overflow-hidden hero-badge-shimmer hero-pop">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-gray-700 font-medium">SMK Negeri 1 Buduran · English Subject</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black mb-5 leading-[1.08] tracking-tight text-gray-900 hero-pop" style={{ animationDelay: "0.12s" }}>
              Welcome to
              <br />
              <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 bg-clip-text text-transparent">
                My Classroom
              </span>
              <br />
              <span className="text-gray-500 text-2xl sm:text-3xl font-bold">English with Mr. Agus</span>
            </h1>

            <p className="text-lg text-gray-600 mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed hero-pop" style={{ animationDelay: "0.24s" }}>
              Kelas digital bahasa Inggris: materi, tugas, absensi, dan nilai — semuanya dalam satu aplikasi.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-10 hero-pop" style={{ animationDelay: "0.36s" }}>
              <Link href="/register">
                <Button size="lg" className="w-full sm:w-auto h-13 px-8 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all text-white font-bold text-base gap-2">
                  Get Started <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="w-full sm:w-auto h-13 px-8 border-gray-300 bg-white hover:bg-gray-50 hover:border-emerald-300 text-gray-700 font-semibold text-base">
                  Sign In
                </Button>
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto lg:mx-0 hero-pop" style={{ animationDelay: "0.48s" }}>
              <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-emerald-300 hover:-translate-y-0.5 transition-all">
                <p className="text-2xl font-black text-gray-900">
                  <CountUp value={allClasses.length || 8} />
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Classes</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-emerald-300 hover:-translate-y-0.5 transition-all">
                <p className="text-2xl font-black text-gray-900">
                  <CountUp value={totalStudents} />
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Students</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-emerald-300 hover:-translate-y-0.5 transition-all">
                <p className="text-2xl font-black text-gray-900">
                  <CountUp value={100} suffix="%" />
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Digital</p>
              </div>
            </div>
          </div>

          {/* Right: branding panel — matches the auth pages */}
          <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white rounded-3xl p-8 shadow-2xl shadow-emerald-500/20 hero-pop" style={{ animationDelay: "0.3s" }}>
            <div className="absolute -top-20 -right-20 w-72 h-72 bg-white/10 rounded-full blur-3xl pointer-events-none floating-blob" />
            <div className="absolute -bottom-24 -left-12 w-72 h-72 bg-teal-400/20 rounded-full blur-3xl pointer-events-none floating-blob" style={{ animationDelay: "-4s" }} />

            <div className="relative">
              <div className="flex items-center gap-3 mb-7">
                <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-xl bg-white/95 p-1 flex-shrink-0">
                  <Image src="/icons/icon-192.png" alt="My Classroom" width={48} height={48} className="w-full h-full object-cover" />
                </div>
                <div>
                  <p className="font-black leading-tight">My Classroom</p>
                  <p className="text-xs text-emerald-100">English Learning Management System</p>
                </div>
              </div>

              <ul className="space-y-3.5">
                {[
                  "Asesmen & tugas online dengan anti-cheat",
                  "Absensi cepat dengan verifikasi lokasi sekolah",
                  "Nilai & rekap kehadiran transparan",
                ].map((text, idx) => (
                  <li
                    key={text}
                    className="flex items-start gap-3 hero-pop"
                    style={{ animationDelay: `${0.5 + idx * 0.12}s` }}
                  >
                    <CheckCircle2 className="w-5 h-5 text-emerald-200 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-emerald-50">{text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-full px-4 py-1.5 mb-4 text-xs font-semibold text-emerald-700 uppercase tracking-wider">
              <Sparkles className="w-3 h-3" /> Features
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-3">Everything You Need</h2>
            <p className="text-gray-600 max-w-md mx-auto">All tools for learning English in one platform</p>
          </Reveal>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {features.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <Reveal key={feature.title} delay={idx * 70}>
                  <div className="group bg-white border border-gray-200 rounded-2xl p-5 h-full hover:shadow-lg hover:shadow-emerald-500/10 hover:border-emerald-300 transition-all duration-300 hover:-translate-y-1.5">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 shadow-md group-hover:shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-bold text-gray-900 text-sm mb-1.5 leading-tight">{feature.title}</h3>
                    <p className="text-xs text-gray-600 leading-relaxed">{feature.desc}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── TEACHER PROFILE ── */}
      {teacherData && (
        <section className="py-8 px-4">
          <div className="max-w-6xl mx-auto">
            <Reveal>
              <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-6 sm:p-8 text-white shadow-xl">
                <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />
                <div className="relative flex flex-col sm:flex-row items-center gap-6">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0 shadow-xl overflow-hidden">
                    {teacher.avatar_url ? (
                      <Image src={teacher.avatar_url} alt={teacher.name} width={96} height={96} className="w-full h-full object-cover" />
                    ) : (
                      <Image src="/icons/icon-192.png" alt={teacher.name} width={96} height={96} className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="text-center sm:text-left flex-1">
                    <p className="text-emerald-100 text-xs font-semibold uppercase tracking-wider mb-1">Your English Teacher</p>
                    <h2 className="text-2xl sm:text-3xl font-black mb-1">{teacher.name}</h2>
                    <p className="text-emerald-50 mb-3 text-sm">{teacher.bio || "English Teacher · SMK Negeri 1 Buduran"}</p>
                    {teacher.tagline && (
                      <p className="text-yellow-300 text-sm italic mb-3">"{teacher.tagline}"</p>
                    )}
                    <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                      {(teacher.certifications?.length > 0 ? teacher.certifications : []).map((cert: string) => (
                        <span key={cert} className="bg-white/20 backdrop-blur-sm text-white text-xs px-3 py-1 rounded-full font-medium">{cert}</span>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 flex-shrink-0">
                    <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-4 text-center">
                      <p className="text-3xl font-black">
                        <CountUp value={allClasses.length || 8} />
                      </p>
                      <p className="text-xs text-emerald-100 mt-1">Classes</p>
                    </div>
                    <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-4 text-center">
                      <p className="text-3xl font-black">
                        <CountUp value={totalStudents} />
                      </p>
                      <p className="text-xs text-emerald-100 mt-1">Students</p>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      )}

      {/* ── CLASSES MARQUEE ── */}
      {hasClasses && (
      <section className="py-16 overflow-hidden">
        <Reveal className="max-w-6xl mx-auto mb-12 text-center px-4">
          <div className="inline-flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-full px-4 py-1.5 mb-4 text-xs font-semibold text-teal-700 uppercase tracking-wider">
            <Users className="w-3 h-3" /> Classes
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-3">Classes Taught</h2>
          <p className="text-gray-600">Academic year 2025/2026</p>
        </Reveal>

        <div className="relative">
          {/* Gradient fade edges */}
          <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />

          <div className="marquee-track">
            {/* Color is keyed to the class itself so both loop copies match */}
            {[...allClasses, ...allClasses].map((cls, idx) => {
              const colors = [
                "from-emerald-500 to-teal-600",
                "from-teal-500 to-cyan-700",
                "from-cyan-600 to-teal-700",
                "from-green-500 to-emerald-700",
                "from-teal-600 to-emerald-800",
                "from-emerald-600 to-green-700",
                "from-green-600 to-teal-700",
                "from-cyan-500 to-emerald-600",
              ];
              const color = colors[(idx % allClasses.length) % colors.length];
              return (
                <div
                  key={`cls-${idx}`}
                  className={`marquee-card bg-gradient-to-br ${color} rounded-2xl p-6 text-white shadow-lg`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-black text-xl leading-tight mb-1">{cls.class_name}</p>
                      <p className="text-white/80 text-sm">{cls.major}</p>
                    </div>
                    <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Users className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-3 border-t border-white/20">
                    <span className="text-xs bg-white/20 px-2 py-1 rounded-md font-semibold">Grade {cls.grade}</span>
                    <span className="text-xs text-white/80">English · {cls.major}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      )}

      {/* ── SCHEDULE ── */}
      {schedules.length > 0 && (
        <section className="py-16 px-4 bg-gray-50">
          <div className="max-w-6xl mx-auto">
            <Reveal className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-4 py-1.5 mb-4 text-xs font-semibold text-amber-700 uppercase tracking-wider">
                <Calendar className="w-3 h-3" /> Schedule
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-3">Teaching Schedule</h2>
            </Reveal>
            <div className="max-w-3xl mx-auto grid sm:grid-cols-2 gap-3">
              {schedules.map((item, idx) => (
                <Reveal key={item.id || idx} delay={idx * 60}>
                  <div className="flex items-center justify-between gap-3 bg-white border border-gray-200 hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-500/10 hover:-translate-y-0.5 rounded-2xl p-4 transition-all">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                        <span className="text-[11px] font-black text-white leading-none">{item.day.substring(0, 3).toUpperCase()}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 text-sm truncate">{item.day}</p>
                        <p className="text-xs text-gray-500 tabular-nums">{item.time}</p>
                      </div>
                    </div>
                    <Badge className="text-xs font-semibold bg-emerald-50 text-emerald-700 border-emerald-200 truncate max-w-[45%]">{item.class_name}</Badge>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── ANNOUNCEMENTS ── */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-full px-4 py-1.5 mb-4 text-xs font-semibold text-rose-700 uppercase tracking-wider">
              <Bell className="w-3 h-3" /> Announcements
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-3">Latest Updates</h2>
          </Reveal>
          <div className="max-w-3xl mx-auto space-y-3">
            {announcements.length === 0 ? (
              <Reveal className="text-center py-12 text-gray-400">
                <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No announcements yet</p>
              </Reveal>
            ) : announcements.map((ann, idx) => (
              <Reveal key={ann.title} delay={idx * 80}>
                <div className="flex gap-4 p-5 bg-white border border-gray-200 hover:shadow-md hover:border-emerald-300 hover:-translate-y-0.5 rounded-2xl transition-all">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0">
                    <Bell className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full border bg-emerald-50 border-emerald-200 text-emerald-700">
                        Announcement
                      </span>
                      <span className="text-xs text-gray-400">{ann.date}</span>
                    </div>
                    <p className="font-bold text-gray-900 text-sm">{ann.title}</p>
                    <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{ann.content}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 px-4 bg-gradient-to-br from-emerald-500 to-teal-600 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/10 rounded-full blur-3xl floating-blob" />
        </div>
        <div className="relative max-w-3xl mx-auto text-center text-white">
          <Reveal>
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-6 shadow-xl">
              <Award className="w-8 h-8 text-white" />
            </div>
          </Reveal>
          <Reveal delay={100}>
            <h2 className="text-3xl sm:text-4xl font-black mb-4">Ready to Start Learning?</h2>
            <p className="text-emerald-50 mb-10 text-lg">Join your classmates and access all English learning materials</p>
          </Reveal>

          <Reveal delay={200}>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-10">
              <Link href="/register">
                <Button size="lg" className="w-full sm:w-auto px-8 h-12 bg-white text-emerald-600 hover:bg-emerald-50 hover:-translate-y-0.5 transition-all font-bold text-base gap-2 shadow-xl">
                  Register Now <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="w-full sm:w-auto px-8 h-12 border-white/30 bg-white/10 hover:bg-white/20 text-white font-semibold text-base backdrop-blur-sm">
                  Sign In
                </Button>
              </Link>
            </div>
          </Reveal>

          <Reveal delay={300}>
            <div className="flex flex-wrap justify-center gap-4 text-sm text-emerald-50">
              {["Free to join", "GPS Attendance", "Instant grades", "Works offline"].map((item) => (
                <div key={item} className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                  {item}
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-gray-200 py-8 px-4 bg-white">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-xl overflow-hidden shadow-md">
              <Image src="/icons/icon-192.png" alt="My Classroom" width={32} height={32} className="w-full h-full object-cover" />
            </div>
            <span className="font-bold text-gray-900">My Classroom</span>
          </div>
          <div className="flex items-center justify-center gap-1.5 text-gray-500 text-xs mb-1">
            <MapPin className="w-3 h-3" />
            <span>SMK Negeri 1 Buduran</span>
          </div>
          <p className="text-gray-400 text-xs">© 2026 My Classroom — Agus Supriyono, S.Pd.,MM</p>
        </div>
      </footer>
    </div>
  );
}
