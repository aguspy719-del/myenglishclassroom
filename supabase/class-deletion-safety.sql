-- ============================================================
-- English LMS — Class deletion safety net (v2)
-- Run this ONCE in the Supabase SQL Editor.
--
-- WHY: deleting a class relies on ON DELETE CASCADE foreign keys.
-- Most tables have them, but a few cases are NOT covered by cascade:
--
--   1. public.users.class_id  → ON DELETE SET NULL (by design:
--      student ACCOUNTS survive a class deletion, only membership
--      is cleared). The app already handles null class_id.
--
--   2. Legacy columns added without an FK constraint — e.g.
--     `essay_answers.quiz_id` in older projects — leave orphaned
--      rows behind after the cascade removes quizzes.
--
--   3. Older `submissions` tables may lack ON DELETE CASCADE on
--      assignment_id, which makes the class DELETE itself fail
--      with a foreign-key violation.
--
-- This migration makes class deletion ALWAYS succeed and never
-- leave orphaned rows, regardless of how the schema was created.
-- Every statement is idempotent — safe to run more than once.
-- ============================================================

-- 1. Submissions: ensure assignment_id cascades with its class's assignments
DO $$
DECLARE
  fk_name text;
  fk_del_type char;
BEGIN
  -- Find the FK on submissions.assignment_id that references assignments
  SELECT c.conname, c.confdeltype
    INTO fk_name, fk_del_type
  FROM pg_constraint c
  JOIN pg_attribute a
    ON a.attrelid = c.conrelid
   AND a.attname = 'assignment_id'
   AND a.attnum = ANY (c.conkey)
  WHERE c.conrelid = 'public.submissions'::regclass
    AND c.contype = 'f'
    AND c.confrelid = 'public.assignments'::regclass
  LIMIT 1;

  IF fk_name IS NULL THEN
    -- No usable FK — (re)create one with cascade
    EXECUTE 'ALTER TABLE public.submissions DROP CONSTRAINT IF EXISTS submissions_assignment_id_fkey';
    ALTER TABLE public.submissions
      ADD CONSTRAINT submissions_assignment_id_fkey
      FOREIGN KEY (assignment_id) REFERENCES public.assignments(id) ON DELETE CASCADE;
    RAISE NOTICE 'submissions.assignment_id FK created with ON DELETE CASCADE';
  ELSIF fk_del_type <> 'c' THEN
    -- FK exists but does not cascade — replace it
    EXECUTE format('ALTER TABLE public.submissions DROP CONSTRAINT %I', fk_name);
    ALTER TABLE public.submissions
      ADD CONSTRAINT submissions_assignment_id_fkey
      FOREIGN KEY (assignment_id) REFERENCES public.assignments(id) ON DELETE CASCADE;
    RAISE NOTICE 'submissions.assignment_id FK repaired to ON DELETE CASCADE';
  ELSE
    RAISE NOTICE 'submissions.assignment_id FK already cascades';
  END IF;
END $$;

-- 2. Essay answers: add the missing FK if the live table never got one
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'essay_answers'
  ) THEN
    RAISE NOTICE 'essay_answers table not found — skipping (nothing to fix)';
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'essay_answers'
      AND constraint_name = 'essay_answers_quiz_id_fkey'
  ) THEN
    ALTER TABLE public.essay_answers
      ADD CONSTRAINT essay_answers_quiz_id_fkey
      FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id) ON DELETE CASCADE;
    RAISE NOTICE 'essay_answers.quiz_id FK created with ON DELETE CASCADE';
  ELSE
    RAISE NOTICE 'essay_answers.quiz_id FK already exists';
  END IF;
END $$;

-- 3. One-time cleanup of rows already orphaned by past deletions
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'essay_answers'
  ) THEN
    DELETE FROM public.essay_answers ea
      WHERE NOT EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = ea.quiz_id);
  END IF;

  DELETE FROM public.submissions s
    WHERE NOT EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = s.assignment_id);

  RAISE NOTICE 'Orphan cleanup done';
END $$;

-- 4. Auto-clean orphaned rows going forward (final safety sweep)
CREATE OR REPLACE FUNCTION public.cleanup_orphans_after_class_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF to_regclass('public.essay_answers') IS NOT NULL THEN
    DELETE FROM public.essay_answers ea
      WHERE NOT EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = ea.quiz_id);
  END IF;

  DELETE FROM public.submissions s
    WHERE NOT EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = s.assignment_id);

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_cleanup_after_class_delete ON public.classes;
CREATE TRIGGER trg_cleanup_after_class_delete
  AFTER DELETE ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_orphans_after_class_delete();

-- 5. Success message (must live inside a DO block — RAISE is
--    not valid at the top level of plain SQL)
DO $$
BEGIN
  RAISE NOTICE 'Class deletion safety net installed successfully.';
END $$;
