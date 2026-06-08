-- Expense analytics enhancements
-- Run once in Supabase SQL editor

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_subscription boolean DEFAULT false;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS subscription_period text;  -- 'monthly' | 'quarterly' | 'annual'
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_ref text;          -- free-text receipt / document reference
