-- ============================================================
-- English LMS - Teaching Journal feature
-- Table matches components/teaching-journal/teaching-journal-client.tsx
-- Run in Supabase SQL Editor if not applied yet.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.teaching_journals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  meeting_number INTEGER NOT NULL DEFAULT 1,
  topic TEXT NOT NULL,
  subtopic TEXT,
  teaching_method TEXT NOT NULL DEFAULT 'ceramah'
    CHECK (teaching_method IN ('ceramah','diskusi','tanya_jawab','presentasi','demonstrasi','game','project','lainnya')),
  students_present INTEGER NOT NULL DEFAULT 0,
  students_absent INTEGER NOT NULL DEFAULT 0,
  learning_objectives TEXT NOT NULL,
  activities TEXT NOT NULL,
  notes TEXT,
  reflection TEXT,
  next_plan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.teaching_journals ENABLE ROW LEVEL SECURITY;

-- Teachers manage only their own journal entries
CREATE POLICY "Teachers manage own teaching journals" ON public.teaching_journals
  FOR ALL
  USING (auth.uid() = teacher_id AND public.get_user_role() = 'teacher')
  WITH CHECK (auth.uid() = teacher_id AND public.get_user_role() = 'teacher');

-- Ordering helper (safe to run repeatedly)
CREATE INDEX IF NOT EXISTS idx_teaching_journals_teacher_date
  ON public.teaching_journals (teacher_id, date DESC);
