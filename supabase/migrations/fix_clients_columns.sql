ALTER TABLE clients ADD COLUMN IF NOT EXISTS client_group text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS address text;
