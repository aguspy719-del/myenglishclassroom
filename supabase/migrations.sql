-- ============================================================
-- English LMS - Database Migrations
-- Run this in Supabase SQL Editor if you already have the
-- base schema (schema.sql) applied.
-- ============================================================

-- 1. Fix teaching_aids: rename doc_key → category
--    (if you created the table with doc_key, run this)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'teaching_aids'
      AND column_name = 'doc_key'
  ) THEN
    ALTER TABLE public.teaching_aids RENAME COLUMN doc_key TO category;
  END IF;
END $$;

-- 2. Gamification columns on users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS badges TEXT[] DEFAULT '{}';

-- 3. Quiz type and scheduled publish
ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS quiz_type TEXT DEFAULT 'formatif',
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- Add check constraint if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'quizzes' AND constraint_name = 'quizzes_quiz_type_check'
  ) THEN
    ALTER TABLE public.quizzes
      ADD CONSTRAINT quizzes_quiz_type_check
      CHECK (quiz_type IN ('formatif', 'sumatif_tengah', 'sumatif_akhir'));
  END IF;
END $$;

-- 4. Text-based assignment submissions
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS submission_type TEXT DEFAULT 'file',
  ADD COLUMN IF NOT EXISTS text_answer TEXT;

-- 5. Essay question support
ALTER TABLE public.quiz_questions
  ADD COLUMN IF NOT EXISTS question_type TEXT DEFAULT 'multiple_choice',
  ADD COLUMN IF NOT EXISTS max_score INTEGER DEFAULT 10;

-- 6. Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info'
    CHECK (type IN ('info', 'points', 'achievement', 'assignment', 'grade')),
  link TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id, read) WHERE read = FALSE;

-- ============================================================
-- Push Subscriptions table (for web push notifications)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own push subscriptions" ON public.push_subscriptions
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);
