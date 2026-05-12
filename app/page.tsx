import Link from "next/link";
import {
  BookOpen,
  GraduationCap,
  Users,
  ClipboardList,
  Star,
  Bell,
  ArrowRight,
  Calendar,
  Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const classes = [
  { name: "XI Butik 1", students: 32, major: "Fashion Design" },
  { name: "XI Butik 2", students: 30, major: "Fashion Design" },
  { name: "XI Garmen", students: 28, major: "Garment" },
  { name: "XI Desain", students: 27, major: "Fashion Design" },
  { name: "XII Butik 1", students: 31, major: "Fashion Design" },
  { name: "XII Butik 2", students: 29, major: "Fashion Design" },
  { name: "XII Garmen", students: 26, major: "Garment" },
  { name: "XII Desain", students: 25, major: "Fashion Design" },
];

const schedule = [
  { day: "Monday", time: "07:30 - 09:00", class: "XI Butik 1" },
  { day: "Monday", time: "09:15 - 10:45", class: "XI Butik 2" },
  { day: "Tuesday", time: "07:30 - 09:00", class: "XI Garmen" },
  { day: "Tuesday", time: "10:00 - 11:30", class: "XI Desain" },
  { day: "Wednesday", time: "07:30 - 09:00", class: "XII Butik 1" },
  { day: "Wednesday", time: "09:15 - 10:45", class: "XII Butik 2" },
  { day: "Thursday", time: "07:30 - 09:00", class: "XII Garmen" },
  { day: "Friday", time: "07:30 - 09:00", class: "XII Desain" },
];

const announcements = [
  {
    title: "Speaking Assignment Submission",
    content: "The speaking assignment for class XI Busana 2 must be submitted no later than Friday, May 16, 2026.",
    date: "May 10, 2026",
    type: "deadline",
  },
  {
    title: "AKM Quiz Next Week",
    content: "An AKM quiz will be held for all Grade X classes next week. Study the Hope & Plan material.",
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
  { icon: BookOpen, title: "Digital Materials", desc: "Access learning materials anytime and anywhere" },
  { icon: ClipboardList, title: "Online Assignments", desc: "Submit assignments digitally with ease" },
  { icon: Star, title: "Transparent Grades", desc: "View grades and feedback directly from your teacher" },
  { icon: Users, title: "Digital Attendance", desc: "Modern digital-based attendance system" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-gray-900 dark:text-white">English LMS</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/register">
              <Button variant="ghost" size="sm">Register</Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="sm">Login</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-950 dark:to-blue-950 py-20 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <Badge variant="info" className="mb-4 text-sm px-4 py-1">
            🎓 SMK — English Subject
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
            Welcome to{" "}
            <span className="text-blue-600 dark:text-blue-400">English Learning</span>
            <br />
            with Mr. Agus
          </h1>
          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
            A digital English learning platform for SMK students. Access materials, submit assignments, and track your grades with ease.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/login">
              <Button size="lg" className="w-full sm:w-auto gap-2 text-base px-8">
                Start Learning <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <Link href="#features">
              <Button variant="outline" size="lg" className="w-full sm:w-auto text-base px-8">
                Learn More
              </Button>
            </Link>
          </div>
        </div>
        <div className="absolute top-20 left-10 w-20 h-20 bg-blue-200 dark:bg-blue-900 rounded-full opacity-30 blur-xl" />
        <div className="absolute bottom-10 right-10 w-32 h-32 bg-indigo-200 dark:bg-indigo-900 rounded-full opacity-30 blur-xl" />
      </section>

      {/* Teacher Profile */}
      <section className="py-16 px-4 bg-white dark:bg-gray-950">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center gap-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-white">
            <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
              <GraduationCap className="w-12 h-12 text-white" />
            </div>
            <div className="text-center md:text-left">
              <h2 className="text-2xl font-bold mb-1">Agus Supriyono, S.Pd.,MM</h2>
              <p className="text-blue-100 mb-3">English Teacher · SMK Negeri 1 Buduran</p>
              <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                <Badge className="bg-white/20 text-white border-white/30">English</Badge>
                <Badge className="bg-white/20 text-white border-white/30">TOEFL Certified</Badge>
                <Badge className="bg-white/20 text-white border-white/30">10+ Years Teaching</Badge>
              </div>
            </div>
            <div className="md:ml-auto grid grid-cols-2 gap-4 text-center">
              <div className="bg-white/10 rounded-xl p-4">
                <p className="text-3xl font-bold">8</p>
                <p className="text-sm text-blue-100">Active Classes</p>
              </div>
              <div className="bg-white/10 rounded-xl p-4">
                <p className="text-3xl font-bold">228</p>
                <p className="text-sm text-blue-100">Total Students</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-16 px-4 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Everything You Need to Learn
            </h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
              All the tools you need to learn English in one place
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.title} className="text-center hover:shadow-md transition-shadow">
                  <CardContent className="pt-6 pb-6">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-xl flex items-center justify-center mx-auto mb-4">
                      <Icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{feature.title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{feature.desc}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Classes */}
      <section className="py-16 px-4 bg-white dark:bg-gray-950">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Classes Taught</h2>
            <p className="text-gray-600 dark:text-gray-400">Active classes for academic year 2025/2026</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-4">
            {classes.map((cls) => (
              <Card key={cls.name} className="hover:shadow-md transition-shadow border-l-4 border-l-blue-500">
                <CardContent className="pt-4 pb-4">
                  <h3 className="font-bold text-gray-900 dark:text-white text-lg">{cls.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{cls.major}</p>
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Users className="w-4 h-4" />
                    <span>{cls.students} students</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Schedule */}
      <section className="py-16 px-4 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              <Calendar className="inline w-8 h-8 mr-2 text-blue-600" />
              Teaching Schedule
            </h2>
          </div>
          <div className="max-w-2xl mx-auto space-y-3">
            {schedule.map((item, idx) => (
              <div
                key={`${item.day}-${idx}`}
                className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{item.day.substring(0, 3).toUpperCase()}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{item.day}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{item.time}</p>
                  </div>
                </div>
                <Badge variant="info">{item.class}</Badge>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Announcements */}
      <section className="py-16 px-4 bg-white dark:bg-gray-950">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              <Bell className="inline w-8 h-8 mr-2 text-blue-600" />
              Latest Announcements
            </h2>
          </div>
          <div className="max-w-3xl mx-auto space-y-4">
            {announcements.map((ann) => (
              <Card key={ann.title} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant={
                            ann.type === "deadline" ? "destructive" :
                            ann.type === "material" ? "success" : "info"
                          }
                          className="text-xs"
                        >
                          {ann.type === "deadline" ? "Deadline" : ann.type === "material" ? "Material" : "Info"}
                        </Badge>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{ann.date}</span>
                      </div>
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{ann.title}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{ann.content}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 bg-gradient-to-r from-blue-600 to-indigo-600">
        <div className="max-w-3xl mx-auto text-center text-white">
          <Award className="w-16 h-16 mx-auto mb-4 opacity-80" />
          <h2 className="text-3xl font-bold mb-4">Ready to Start Learning?</h2>
          <p className="text-blue-100 mb-8 text-lg">
            Login now and access all your materials, assignments, and grades
          </p>
          <Link href="/login">
            <Button size="lg" variant="secondary" className="gap-2 text-base px-8">
              Login Now <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-white">English LMS</span>
          </div>
          <p className="text-sm">© 2026 English LMS — Agus Supriyono, S.Pd.,MM. All rights reserved.</p>
          <p className="text-xs mt-2">Built with ❤️ for better English education in Indonesia</p>
        </div>
      </footer>
    </div>
  );
}
