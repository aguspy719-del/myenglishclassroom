-- ============================================================
-- English LMS — Class deletion safety net
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
  fk_exists boolean;
  fk_cascades boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.table_schema = tc.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'submissions'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND ccu.column_name = 'assignment_id'
  ) INTO fk_exists;

  IF fk_exists THEN
    SELECT (
      confdeltype = 'c'
    ) INTO fk_cascades
    FROM pg_constraint
    WHERE conrelid = 'public.submissions'::regclass
      AND contype = 'f'
      AND conname IN (
        SELECT constraint_name FROM information_schema.constraint_column_usage
        WHERE table_schema = 'public' AND table_name = 'submissions'
          AND column_name = 'assignment_id'
      )
    LIMIT 1;

    IF fk_cascades IS DISTINCT FROM TRUE THEN
      EXECUTE 'ALTER TABLE public.submissions DROP CONSTRAINT IF EXISTS submissions_assignment_id_fkey';
      EXECUTE 'ALTER TABLE public.submissions
        ADD CONSTRAINT submissions_assignment_id_fkey
        FOREIGN KEY (assignment_id) REFERENCES public.assignments(id) ON DELETE CASCADE';
      RAISE NOTICE 'submissions.assignment_id FK repaired to ON DELETE CASCADE';
    ELSE
      RAISE NOTICE 'submissions.assignment_id FK already cascades';
    END IF;
  ELSE
    EXECUTE 'ALTER TABLE public.submissions
      ADD CONSTRAINT submissions_assignment_id_fkey
      FOREIGN KEY (assignment_id) REFERENCES public.assignments(id) ON DELETE CASCADE';
    RAISE NOTICE 'submissions.assignment_id FK created with ON DELETE CASCADE';
  END IF;
END $$;

-- 2. Essay answers: add the missing FK if the live table never got one
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'essay_answers'
      AND constraint_type = 'FOREIGN KEY'
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
--    (these RUN immediately, they are not triggers)

-- Essay answers whose quiz no longer exists
DELETE FROM public.essay_answers ea
  WHERE NOT EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = ea.quiz_id);

-- Submissions whose assignment no longer exists
DELETE FROM public.submissions s
  WHERE NOT EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = s.assignment_id);

-- 4. Optional: auto-clean orphaned rows going forward.
--    Only needed if statement 1/2 could not be applied
--    (e.g. permissions). Skips silently when the FKs cascade.
--    The function is SECURITY DEFINER so it can delete via cascade-less paths.
CREATE OR REPLACE FUNCTION public.cleanup_orphans_after_class_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Keep tables tidy if any cascade-less FK remains
  DELETE FROM public.essay_answers ea
    WHERE NOT EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = ea.quiz_id);
  DELETE FROM public.submissions s
    WHERE NOT EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = s.assignment_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_cleanup_after_class_delete ON public.classes;
CREATE TRIGGER trg_cleanup_after_class_delete
  AFTER DELETE ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_orphans_after_class_delete();

RAISE NOTICE 'Class deletion safety net installed successfully.';
