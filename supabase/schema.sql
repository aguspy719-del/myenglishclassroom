-- ============================================================
-- English LMS - Supabase Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('teacher', 'student')),
  class_id UUID,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Classes table
CREATE TABLE IF NOT EXISTS public.classes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  class_name TEXT NOT NULL,
  major TEXT NOT NULL,
  grade TEXT NOT NULL CHECK (grade IN ('X', 'XI', 'XII')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key for users.class_id after classes table is created
ALTER TABLE public.users
  ADD CONSTRAINT fk_users_class
  FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE SET NULL;

-- Materials table
CREATE TABLE IF NOT EXISTS public.materials (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  topic TEXT,
  meeting INTEGER,
  file_url TEXT,
  file_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Assignments table
CREATE TABLE IF NOT EXISTS public.assignments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  deadline TIMESTAMPTZ NOT NULL,
  attachment_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Submissions table
CREATE TABLE IF NOT EXISTS public.submissions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  file_url TEXT,
  score INTEGER CHECK (score >= 0 AND score <= 100),
  feedback TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(assignment_id, student_id)
);

-- Attendance table
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, class_id, date)
);

-- Announcements table
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quizzes table
CREATE TABLE IF NOT EXISTS public.quizzes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  time_limit INTEGER, -- in minutes
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quiz Questions table
CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_answer TEXT NOT NULL CHECK (correct_answer IN ('a', 'b', 'c', 'd')),
  order_number INTEGER DEFAULT 1
);

-- Quiz Attempts table
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  score INTEGER CHECK (score >= 0 AND score <= 100),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER FUNCTION: Get current user role
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- USERS: Users can read all profiles, update their own
CREATE POLICY "Users can view all profiles" ON public.users
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Teachers can insert users" ON public.users
  FOR INSERT WITH CHECK (public.get_user_role() = 'teacher');

-- CLASSES: Everyone can read, only teachers can write
CREATE POLICY "Anyone can view classes" ON public.classes
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Teachers can manage classes" ON public.classes
  FOR ALL USING (public.get_user_role() = 'teacher');

-- MATERIALS: Everyone can read, only teachers can write
CREATE POLICY "Anyone can view materials" ON public.materials
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Teachers can manage materials" ON public.materials
  FOR ALL USING (public.get_user_role() = 'teacher');

-- ASSIGNMENTS: Everyone can read, only teachers can write
CREATE POLICY "Anyone can view assignments" ON public.assignments
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Teachers can manage assignments" ON public.assignments
  FOR ALL USING (public.get_user_role() = 'teacher');

-- SUBMISSIONS: Students can manage their own, teachers can view all
CREATE POLICY "Students can manage own submissions" ON public.submissions
  FOR ALL USING (
    auth.uid() = student_id OR public.get_user_role() = 'teacher'
  );

-- ATTENDANCE: Students can manage their own, teachers can view all
CREATE POLICY "Students can manage own attendance" ON public.attendance
  FOR ALL USING (
    auth.uid() = student_id OR public.get_user_role() = 'teacher'
  );

-- ANNOUNCEMENTS: Everyone can read, only teachers can write
CREATE POLICY "Anyone can view announcements" ON public.announcements
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Teachers can manage announcements" ON public.announcements
  FOR ALL USING (public.get_user_role() = 'teacher');

-- QUIZZES: Everyone can read, only teachers can write
CREATE POLICY "Anyone can view quizzes" ON public.quizzes
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Teachers can manage quizzes" ON public.quizzes
  FOR ALL USING (public.get_user_role() = 'teacher');

-- QUIZ QUESTIONS: Everyone can read, only teachers can write
CREATE POLICY "Anyone can view quiz questions" ON public.quiz_questions
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Teachers can manage quiz questions" ON public.quiz_questions
  FOR ALL USING (public.get_user_role() = 'teacher');

-- QUIZ ATTEMPTS: Students can manage their own, teachers can view all
CREATE POLICY "Students can manage own attempts" ON public.quiz_attempts
  FOR ALL USING (
    auth.uid() = student_id OR public.get_user_role() = 'teacher'
  );

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
-- Run these in Supabase Dashboard > Storage > New Bucket
-- Or use the SQL below:

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('materials', 'materials', true),
  ('assignments', 'assignments', true),
  ('submissions', 'submissions', false),
  ('videos', 'videos', true),
  ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Public read for materials" ON storage.objects
  FOR SELECT USING (bucket_id = 'materials');

CREATE POLICY "Teachers can upload materials" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'materials' AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Public read for assignments" ON storage.objects
  FOR SELECT USING (bucket_id = 'assignments');

CREATE POLICY "Teachers can upload assignments" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'assignments' AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Authenticated users can upload submissions" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'submissions' AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can read own submissions" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'submissions' AND
    auth.uid() IS NOT NULL
  );

-- ============================================================
-- TRIGGER: Auto-create user profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- SEED DATA (Optional - for testing)
-- ============================================================

-- Insert sample classes
INSERT INTO public.classes (class_name, major, grade) VALUES
  ('XI Butik 1', 'Tata Busana', 'XI'),
  ('XI Butik 2', 'Tata Busana', 'XI'),
  ('XI Garmen', 'Tata Busana', 'XI'),
  ('XI Desain', 'Tata Busana', 'XI'),
  ('XII Butik 1', 'Tata Busana', 'XII'),
  ('XII Butik 2', 'Tata Busana', 'XII'),
  ('XII Garmen', 'Tata Busana', 'XII'),
  ('XII Desain', 'Tata Busana', 'XII')
ON CONFLICT DO NOTHING;

-- Insert sample announcements
INSERT INTO public.announcements (title, content) VALUES
  ('Selamat Datang di English LMS', 'Selamat datang di platform pembelajaran Bahasa Inggris SMK. Silakan login dan mulai belajar!'),
  ('Jadwal Kuis AKM', 'Kuis AKM akan dilaksanakan minggu depan. Pelajari materi Hope & Plan dengan baik.')
ON CONFLICT DO NOTHING;
