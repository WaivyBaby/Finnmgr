-- Income Command Center — adds income_type for richer categorisation
-- Safe to run multiple times (IF NOT EXISTS)
ALTER TABLE income ADD COLUMN IF NOT EXISTS income_type text;
-- Suggested values: 'Service' | 'Product' | 'Subscription' | 'Consulting' | 'Retainer' | 'Commission' | 'Other'
