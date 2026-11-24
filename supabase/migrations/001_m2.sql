-- Đô Thị Ảo — M2 migration 001 (SRS v2.1 §5)
-- Economy: profiles + inventory + assets + transaction log (idempotent) +
-- player_jobs / player_missions / player_sessions + game_items seed.
-- Run in Supabase SQL Editor (or `supabase db push`). Requires pgcrypto
-- for gen_random_uuid() — enabled by default on Supabase.
create extension if not exists "pgcrypto";

-- Profiles: ONE row per account. Cash DEFAULT 0 (SRS §4.5/§5.1) — the
-- 50.000đ starter grant is a TRANSACTION (rpc_starter_grant), never a
-- hardcoded default, so it can only ever be given once.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'CongDan',
  cash bigint not null default 0 check (cash >= 0),
  bank bigint not null default 0 check (bank >= 0),
  level integer not null default 1 check (level >= 1),
  exp bigint not null default 0 check (exp >= 0),
  avatar_key text not null default 'hero',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Inventory: one row per (player, item).
create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  item_id text not null,
  qty integer not null default 0 check (qty >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, item_id)
);

-- Assets: vehicles / property (M2: Wave bike is an asset; M4 adds taxi/doctor gear).
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  asset_id text not null,
  qty integer not null default 1 check (qty >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, asset_id)
);

-- Transaction Ledger: append-only. idempotency_key UNIQUE — a retried
-- request with the same key returns ALREADY_PROCESSED and changes nothing.
create table if not exists public.transaction_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  type text not null, -- starter_grant | shop_buy | shop_sell | atm | job_reward | faint_loss | hospital_fee | use_item | gacha (later)
  amount bigint not null, -- negative = spend, positive = earn
  balance_after bigint not null,
  idempotency_key uuid not null unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_tx_user_created on public.transaction_logs (user_id, created_at desc);

-- Player jobs (M2: shipper only; M4 adds taxi/doctor).
create table if not exists public.player_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  job_id text not null,
  status text not null default 'active', -- active | completed | cancelled | failed
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_jobs_user on public.player_jobs (user_id, created_at desc);

-- Player missions (tutorial 5 steps, M2).
create table if not exists public.player_missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  mission_id text not null,
  status text not null default 'active', -- active | completed
  progress jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, mission_id)
);

-- Player sessions (online time, for playtime tracking).
create table if not exists public.player_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  ip text
);

-- Game items (server price table — client never sets prices).
create table if not exists public.game_items (
  item_id text primary key,
  name text not null,
  price bigint not null check (price >= 0),
  day_price bigint, -- optional daytime price (bánh mì 13.500đ day vs 15.000đ night)
  hunger_restore integer not null default 0,
  stamina_restore integer not null default 0,
  is_active boolean not null default true
);

insert into public.game_items (item_id, name, price, day_price, hunger_restore, stamina_restore)
values
  ('banh_mi', 'Bánh mì', 15000, 13500, 40, 0),
  ('nuoc_tang_luc', 'Nước tăng lực', 10000, null, 0, 50)
on conflict (item_id) do update set
  name = excluded.name, price = excluded.price, day_price = excluded.day_price,
  hunger_restore = excluded.hunger_restore, stamina_restore = excluded.stamina_restore;

-- updated_at trigger
create or replace function public.set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;
drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
drop trigger if exists trg_jobs_updated on public.player_jobs;
create trigger trg_jobs_updated before update on public.player_jobs
  for each row execute function public.set_updated_at();
drop trigger if exists trg_missions_updated on public.player_missions;
create trigger trg_missions_updated before update on public.player_missions
  for each row execute function public.set_updated_at();
