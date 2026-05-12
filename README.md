# 🎓 English LMS - SMK Mr. Agus

A modern, mobile-first Learning Management System for English subject at SMK (Vocational High School), built with Next.js 15, TypeScript, Tailwind CSS, and Supabase.

---

## ✨ Features

### For Teachers
- 📊 Dashboard with stats (students, classes, assignments, pending grades)
- 🏫 Class management (create, view, delete classes)
- 📚 Material upload (PDF, DOCX, PPT, MP4, etc.)
- 📝 Assignment creation with deadlines and file attachments
- ✅ View and grade student submissions with feedback
- 📋 Attendance monitoring by class and date
- 🎯 Quiz/AKM creation with multiple choice questions
- 📣 Announcements management

### For Students
- 🏠 Personal dashboard with upcoming tasks and grades
- 📖 Access learning materials and download files
- 📤 Submit assignments with file upload
- 📊 View grades and teacher feedback
- ✋ Mark daily attendance (present/late/absent/excused)
- 🧠 Take quizzes with auto-scoring and timer
- 🔔 View announcements

### General
- 🌙 Dark/Light mode
- 📱 Mobile-first responsive design
- 🔐 Role-based authentication (Teacher/Student)
- 🔍 Search and filter functionality
- ⚡ Fast loading with optimistic UI

---

## 🛠 Tech Stack

| Technology | Purpose |
|-----------|---------|
| Next.js 15 (App Router) | Frontend framework |
| TypeScript | Type safety |
| Tailwind CSS | Styling |
| Shadcn UI (Radix UI) | UI components |
| Supabase Auth | Authentication |
| Supabase Database | PostgreSQL database |
| Supabase Storage | File storage |
| Sonner | Toast notifications |
| Lucide React | Icons |
| next-themes | Dark/light mode |
| Vercel | Deployment |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Supabase account (free tier works)

### 1. Clone and Install

```bash
git clone https://github.com/yourusername/english-lms.git
cd english-lms
npm install
```

### 2. Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Go to **Settings > API** and copy:
   - Project URL
   - Anon/Public key

### 3. Configure Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Set Up Database

1. Go to your Supabase project > **SQL Editor**
2. Copy the contents of `supabase/schema.sql`
3. Paste and run it in the SQL Editor

This will create:
- All tables with proper relationships
- Row Level Security (RLS) policies
- Storage buckets
- Auto-create user profile trigger
- Sample seed data (classes, announcements)

### 5. Create Test Users

In Supabase Dashboard > **Authentication > Users**, create test users:

**Teacher account:**
- Email: `guru@smk.sch.id`
- Password: `password123`
- After creating, run this SQL to set role:
```sql
UPDATE public.users SET role = 'teacher', name = 'Mr. Agus Setiawan' 
WHERE email = 'guru@smk.sch.id';
```

**Student account:**
- Email: `siswa@smk.sch.id`  
- Password: `password123`
- After creating, run this SQL to assign to a class:
```sql
UPDATE public.users 
SET role = 'student', name = 'Budi Santoso',
    class_id = (SELECT id FROM classes WHERE class_name = 'X Busana 1' LIMIT 1)
WHERE email = 'siswa@smk.sch.id';
```

### 6. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 📁 Project Structure

```
english-lms/
├── app/                          # Next.js App Router pages
│   ├── page.tsx                  # Landing page
│   ├── login/page.tsx            # Login page
│   ├── dashboard/page.tsx        # Dashboard
│   ├── classes/
│   │   ├── page.tsx              # Classes list
│   │   └── [id]/page.tsx         # Class detail
│   ├── materials/
│   │   ├── page.tsx              # Materials list
│   │   └── upload/page.tsx       # Upload material
│   ├── assignments/
│   │   ├── page.tsx              # Assignments list
│   │   ├── create/page.tsx       # Create assignment
│   │   └── [id]/page.tsx         # Assignment detail + submission
│   ├── attendance/page.tsx       # Attendance
│   ├── grades/page.tsx           # Grades
│   ├── quiz/
│   │   ├── page.tsx              # Quiz list
│   │   └── [id]/page.tsx         # Take quiz
│   └── profile/page.tsx          # User profile
│
├── components/
│   ├── ui/                       # Shadcn UI components
│   ├── layout/                   # Sidebar, Navbar, DashboardLayout
│   ├── dashboard/                # Teacher & Student dashboards
│   ├── classes/                  # Class components
│   ├── materials/                # Material components
│   ├── assignments/              # Assignment components
│   ├── attendance/               # Attendance components
│   ├── grades/                   # Grades components
│   ├── quiz/                     # Quiz components
│   ├── profile/                  # Profile components
│   └── providers/                # Theme provider
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # Browser Supabase client
│   │   ├── server.ts             # Server Supabase client
│   │   └── middleware.ts         # Auth middleware
│   └── utils.ts                  # Utility functions
│
├── types/
│   └── index.ts                  # TypeScript types
│
├── supabase/
│   └── schema.sql                # Database schema
│
├── middleware.ts                 # Next.js middleware
├── .env.local                    # Environment variables
└── README.md
```

---

## 🗄 Database Schema

```
users          → id, name, email, role, class_id, avatar_url
classes        → id, class_name, major, grade
materials      → id, class_id, title, description, topic, meeting, file_url
assignments    → id, class_id, title, description, deadline, attachment_url
submissions    → id, assignment_id, student_id, file_url, score, feedback
attendance     → id, student_id, class_id, date, status, timestamp
announcements  → id, title, content
quizzes        → id, class_id, title, description, time_limit
quiz_questions → id, quiz_id, question, option_a-d, correct_answer
quiz_attempts  → id, quiz_id, student_id, score, started_at, completed_at
```

---

## 🌐 Deployment to Vercel

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and import your repository
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy!

---

## 📱 Mobile Support

The app is fully mobile-responsive with:
- Touch-friendly buttons (min 44px height)
- Collapsible sidebar with overlay
- Mobile-optimized forms
- Responsive grid layouts
- Large tap targets for students

---

## 🔐 Security

- Row Level Security (RLS) on all Supabase tables
- Role-based access control (teacher vs student)
- Protected routes via middleware
- Secure file uploads to Supabase Storage
- Input validation on all forms

---

## 📄 License

MIT License - feel free to use for educational purposes.

---

Made with ❤️ for SMK English Education
