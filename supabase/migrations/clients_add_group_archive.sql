-- Run in Supabase SQL Editor

-- Add group_name field for client grouping
ALTER TABLE clients ADD COLUMN IF NOT EXISTS group_name text;

-- Add archived_at for soft-archive (preserves all linked records)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Ensure budget_categories table exists with RLS
CREATE TABLE IF NOT EXISTS budget_categories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  icon text DEFAULT '💼',
  monthly_limit numeric(12,2) NOT NULL DEFAULT 0,
  alert_at_percent integer DEFAULT 80,
  auto_reset boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT NOW()
);

ALTER TABLE budget_categories ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'budget_categories' AND policyname = 'users_own_budgets'
  ) THEN
    CREATE POLICY "users_own_budgets"
      ON budget_categories FOR ALL
      USING (auth.uid() = user_id);
  END IF;
END $$;
