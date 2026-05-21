# English LMS — SMK Negeri 1 Buduran

Platform pembelajaran Bahasa Inggris digital untuk **Agus Supriyono, S.Pd.,MM** dan siswa SMK Negeri 1 Buduran.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 3 |
| UI Components | Radix UI (shadcn/ui pattern) |
| Backend/DB | Supabase (PostgreSQL + Auth + Storage) |
| Forms | react-hook-form + zod |
| Charts | Recharts |
| Excel Export | xlsx |
| Notifications | Sonner |
| PWA | Service Worker + Web App Manifest |

## Fitur

### Guru
- Dashboard dengan statistik kelas
- Manajemen kelas (buat, edit, hapus)
- Upload materi pembelajaran (PDF, DOCX, PPT, MP4)
- Buat tugas untuk satu atau banyak kelas sekaligus
- Nilai dan beri feedback submission siswa
- Absensi digital
- Buat assessment (Formatif, STS, SAS) dengan soal pilihan ganda & essay
- Copy soal ke kelas lain
- Export rapor ke Excel per kelas
- Teaching Aids (dokumen administrasi: CP, ATP, Modul Ajar, dll)

### Siswa
- Dashboard dengan XP/gamifikasi (level, badge, poin)
- Akses materi kelas
- Submit tugas (upload file atau tulis jawaban langsung)
- Lihat nilai dan feedback
- Absensi mandiri
- Kerjakan assessment dengan timer + anti-cheat
- Speaking practice dengan Web Speech API + AI scoring
- Notifikasi real-time

## Setup

### 1. Clone & Install

```bash
git clone <repo>
cd english-lms
npm install
```

### 2. Environment Variables

Copy `.env.example` ke `.env.local` dan isi:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Database Setup

Buka **Supabase SQL Editor** dan jalankan:

1. **`supabase/schema.sql`** — buat semua tabel dari awal
2. **`supabase/migrations.sql`** — jika schema sudah ada, jalankan ini untuk menambah kolom baru

### 4. Run Development

```bash
npm run dev
```

## Struktur Database

```
users          — profil user (teacher/student) + gamifikasi
classes        — data kelas
materials      — materi pembelajaran
assignments    — tugas
submissions    — pengumpulan tugas siswa
attendance     — absensi
quizzes        — assessment (formatif/STS/SAS)
quiz_questions — soal (pilihan ganda + essay)
quiz_attempts  — hasil pengerjaan siswa
notifications  — notifikasi gamifikasi
teaching_aids  — dokumen administrasi guru
announcements  — pengumuman
```

## Struktur Folder

```
app/                  — Next.js App Router pages
components/
  assignments/        — halaman tugas
  attendance/         — absensi
  classes/            — daftar & detail kelas
  dashboard/          — dashboard guru & siswa
  grades/             — nilai & rapor
  layout/             — navbar, sidebar, notifikasi
  materials/          — materi
  profile/            — profil user
  providers/          — theme, PWA, offline
  quiz/               — assessment
  speaking/           — speaking practice
  teaching-aids/      — dokumen administrasi
  ui/                 — komponen UI dasar
lib/
  gamification.ts     — sistem XP, level, badge
  offline-cache.ts    — IndexedDB cache untuk offline
  supabase/           — client & server Supabase
  utils.ts            — utility functions
types/
  index.ts            — TypeScript types
public/
  manifest.json       — PWA manifest
  sw.js               — Service Worker
  icons/              — app icons
supabase/
  schema.sql          — schema lengkap
  migrations.sql      — migration untuk update DB
```

## Deployment

Deploy ke Vercel:

```bash
npm run build
vercel --prod
```

Pastikan environment variables sudah diset di Vercel dashboard.
