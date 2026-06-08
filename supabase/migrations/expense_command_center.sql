-- Expense Command Center — integration-ready fields
-- Builds on expense_analytics.sql (is_subscription, subscription_period, notes, receipt_ref)
-- Safe to run multiple times (ADD COLUMN IF NOT EXISTS)

-- Receipt & documentation
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_url text;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS business_purpose text;

-- Integration-ready fields for future Plaid / card / POS import
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS source_system text DEFAULT 'manual';
  -- values: 'manual' | 'plaid' | 'stripe' | 'square' | 'shopify' | 'csv_import' | 'bank_feed'
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS source_account text;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS external_transaction_id text;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS vendor_id text;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS account_last4 text;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS matched_document_id uuid;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS sync_status text DEFAULT 'manual';
  -- values: 'manual' | 'synced' | 'pending' | 'review' | 'ignored'
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS imported_at timestamptz;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS linked_client text;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS linked_project text;
