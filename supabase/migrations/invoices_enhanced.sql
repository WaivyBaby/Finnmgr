-- Run this in Supabase SQL Editor to upgrade the invoices table

-- Add all missing columns (safe - skips if already exists)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS line_items jsonb DEFAULT '[]';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS issue_date date DEFAULT current_date;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subtotal numeric(12,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_rate numeric(5,3) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_amount numeric(12,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total numeric(12,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_paid numeric(12,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS balance_due numeric(12,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_type text DEFAULT 'percent';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_value numeric(10,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_amount numeric(12,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS internal_notes text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS client_address text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS deposit_account text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS reference_number text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS viewed_at timestamptz;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_at timestamptz;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_probability text DEFAULT 'medium';

-- Migrate existing items -> line_items
UPDATE invoices
SET line_items = items
WHERE (line_items IS NULL OR line_items = '[]'::jsonb)
  AND items IS NOT NULL
  AND items != '[]'::jsonb;

-- Recalculate totals from line_items for existing rows
UPDATE invoices
SET
  subtotal = (
    SELECT COALESCE(SUM((item->>'qty')::numeric * (item->>'rate')::numeric), 0)
    FROM jsonb_array_elements(COALESCE(line_items, items, '[]'::jsonb)) AS item
  ),
  total = (
    SELECT COALESCE(SUM((item->>'qty')::numeric * (item->>'rate')::numeric), 0)
    FROM jsonb_array_elements(COALESCE(line_items, items, '[]'::jsonb)) AS item
  ),
  balance_due = (
    SELECT COALESCE(SUM((item->>'qty')::numeric * (item->>'rate')::numeric), 0)
    FROM jsonb_array_elements(COALESCE(line_items, items, '[]'::jsonb)) AS item
  )
WHERE total = 0;

-- Update status constraint to allow all needed values
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('draft', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'cancelled', 'refunded'));

-- Mark overdue invoices
UPDATE invoices
SET status = 'overdue'
WHERE status = 'sent'
  AND due_date < current_date;
