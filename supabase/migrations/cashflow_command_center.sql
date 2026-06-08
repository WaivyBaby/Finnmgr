-- Cash Flow Command Center — manual cash balance tracking
-- Run once in Supabase SQL editor

CREATE TABLE IF NOT EXISTS cash_balances (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  account_name text NOT NULL DEFAULT 'Primary Account',
  balance      numeric(12,2) NOT NULL DEFAULT 0,
  balance_date date NOT NULL,
  notes        text,
  created_at   timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE cash_balances ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'cash_balances' AND policyname = 'Users manage own balances'
  ) THEN
    CREATE POLICY "Users manage own balances" ON cash_balances
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END;
$$;
