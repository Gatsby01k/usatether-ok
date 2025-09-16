
-- USATether schema (Supabase / Postgres)

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  created_at timestamptz not null default now()
);

create table if not exists public.deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  amount_usat numeric(18,6) not null check (amount_usat > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  amount_usat numeric(18,6) not null check (amount_usat > 0),
  created_at timestamptz not null default now()
);

-- RLS (row level security)
alter table public.users enable row level security;
alter table public.deposits enable row level security;
alter table public.withdrawals enable row level security;

-- Policies: users can read/write only their own data
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='users' and policyname='Users can select/update own row') then
    create policy "Users can select/update own row" on public.users
      for select using (auth.uid() = id)
      with check (auth.uid() = id);
    create policy "Users can insert own row" on public.users
      for insert with check (true);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='deposits' and policyname='Users can manage own deposits') then
    create policy "Users can manage own deposits" on public.deposits
      for all using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='withdrawals' and policyname='Users can manage own withdrawals') then
    create policy "Users can manage own withdrawals" on public.withdrawals
      for all using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- Helper: upsert user by email after auth (optional serverless will handle)
