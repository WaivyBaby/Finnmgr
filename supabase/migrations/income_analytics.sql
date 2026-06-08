-- Income analytics enhancements
-- Run once in Supabase SQL editor

-- Recurring income tracking
ALTER TABLE income ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false;
ALTER TABLE income ADD COLUMN IF NOT EXISTS recurrence_period text; -- 'monthly' | 'quarterly' | 'annual'

-- Invoice / document reference link (free-text, not FK to keep it simple)
ALTER TABLE income ADD COLUMN IF NOT EXISTS invoice_ref text;

-- Revenue goals (per-user, per-period)
CREATE TABLE IF NOT EXISTS revenue_goals (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  period_type text NOT NULL CHECK (period_type IN ('monthly','quarterly','annual')),
  period_label text NOT NULL,                         -- e.g. '2026-06', '2026-Q2', '2026'
  target_amount numeric(12,2) NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now() NOT NULL,
  updated_at  timestamptz DEFAULT now() NOT NULL,
  UNIQUE (user_id, period_type, period_label)
);

ALTER TABLE revenue_goals ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'revenue_goals' AND policyname = 'Users manage own goals'
  ) THEN
    CREATE POLICY "Users manage own goals" ON revenue_goals
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END;
$$;
