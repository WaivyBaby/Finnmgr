-- Budget Command Center — enhanced budget category fields
-- Safe to run multiple times (ADD COLUMN IF NOT EXISTS)

ALTER TABLE budget_categories ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE budget_categories ADD COLUMN IF NOT EXISTS alert_threshold numeric DEFAULT 80;
  -- Percentage at which to warn (default 80%)
ALTER TABLE budget_categories ADD COLUMN IF NOT EXISTS linked_expense_category text;
  -- Override: which expense category feeds this budget line (null = use category name)
ALTER TABLE budget_categories ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE budget_categories ADD COLUMN IF NOT EXISTS period text DEFAULT 'monthly';
  -- 'monthly' | 'quarterly' | 'annual'
ALTER TABLE budget_categories ADD COLUMN IF NOT EXISTS rollover boolean DEFAULT false;
  -- Whether unused budget carries forward to next month
