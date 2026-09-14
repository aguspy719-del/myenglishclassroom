-- ============================================================
-- English LMS — Quiz Send/Schedule + Anti-Cheat Violations
-- Run this whole file in Supabase Dashboard → SQL Editor.
-- Safe to re-run (idempotent).
-- ============================================================

-- 1. Quiz send/schedule columns
ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS available_until TIMESTAMPTZ;

-- Backfill: old quizzes were instantly visible to students
UPDATE public.quizzes SET is_published = TRUE WHERE is_published IS NULL;

-- 2. Per-attempt anti-cheat violation log
ALTER TABLE public.quiz_attempts
  ADD COLUMN IF NOT EXISTS violations INTEGER NOT NULL DEFAULT 0;

-- 3. Log of every exit/cheat event (for teacher review)
CREATE TABLE IF NOT EXISTS public.quiz_violations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  attempt_id UUID REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,          -- e.g. tab_switch, fullscreen_exit, clipboard
  detail TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.quiz_violations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can log own violations" ON public.quiz_violations;
DROP POLICY IF EXISTS "Teachers can view violations" ON public.quiz_violations;

CREATE POLICY "Students can log own violations" ON public.quiz_violations
  FOR INSERT WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Teachers can view violations" ON public.quiz_violations
  FOR SELECT USING (
    auth.uid() = student_id OR public.get_user_role() = 'teacher'
  );

CREATE INDEX IF NOT EXISTS idx_quiz_violations_quiz
  ON public.quiz_violations(quiz_id);

-- 4. Scheduled-send push queue (processed by /api/quiz/process-scheduled)
CREATE TABLE IF NOT EXISTS public.push_sent (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  scheduled_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.push_sent ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read push queue" ON public.push_sent;
CREATE POLICY "Anyone can read push queue" ON public.push_sent
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 5. essay_answers RLS (table may already exist in the live project;
--    these are additive and safe when it already has policies)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'essay_answers') THEN
    EXECUTE 'ALTER TABLE public.essay_answers ENABLE ROW LEVEL SECURITY';

    IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE schemaname = 'public' AND tablename = 'essay_answers'
                     AND policyname = 'Students can manage own essay answers') THEN
      EXECUTE 'CREATE POLICY "Students can manage own essay answers" ON public.essay_answers
               FOR ALL USING (auth.uid() = student_id OR public.get_user_role() = ''teacher'')';
    END IF;
  END IF;
END $$;

-- 6. Faster schedule queries
CREATE INDEX IF NOT EXISTS idx_quizzes_published_at ON public.quizzes(published_at);
