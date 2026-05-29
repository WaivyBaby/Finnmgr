-- Transactions table
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  description text not null,
  amount numeric(12,2) not null,
  type text check (type in ('income', 'expense')) not null,
  category text not null default 'Other',
  date date not null default current_date,
  created_at timestamptz default now()
);

alter table public.transactions enable row level security;

create policy "Users can manage their own transactions"
  on public.transactions
  for all using (auth.uid() = user_id);

-- Documents table
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  file_path text not null,
  file_size bigint not null default 0,
  file_type text not null default '',
  created_at timestamptz default now()
);

alter table public.documents enable row level security;

create policy "Users can manage their own documents"
  on public.documents
  for all using (auth.uid() = user_id);

-- Invoices table
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  invoice_number text not null,
  client_name text not null,
  client_email text,
  items jsonb not null default '[]',
  status text check (status in ('draft', 'sent', 'paid')) not null default 'draft',
  due_date date not null,
  created_at timestamptz default now()
);

alter table public.invoices enable row level security;

create policy "Users can manage their own invoices"
  on public.invoices
  for all using (auth.uid() = user_id);

-- Storage bucket for documents
insert into storage.buckets (id, name, public)
  values ('documents', 'documents', false)
  on conflict do nothing;

create policy "Users can upload their own documents"
  on storage.objects for insert
  with check (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can read their own documents"
  on storage.objects for select
  using (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can delete their own documents"
  on storage.objects for delete
  using (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);
