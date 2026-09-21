-- Digital Heroes Level 1 - Complete Database Schema Migration
-- Includes tables, triggers, constraints, RLS policies, storage configuration, and seed data.

create extension if not exists "pgcrypto";

-- Custom Enums
create type public.app_role as enum ('subscriber', 'admin');
create type public.plan_interval as enum ('monthly', 'yearly');
create type public.subscription_status as enum ('active', 'cancelled', 'past_due', 'inactive');
create type public.draw_mode as enum ('random', 'algorithmic');
create type public.draw_status as enum ('simulation', 'published');
create type public.proof_status as enum ('pending', 'approved', 'rejected', 'paid');
create type public.donation_source as enum ('subscription', 'independent');

-- 1. Profiles Table (linked to Supabase Auth)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  role public.app_role not null default 'subscriber',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Subscription Plans Table
create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  interval public.plan_interval unique not null,
  amount numeric(10,2) not null check (amount > 0),
  discount_description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 3. Subscriptions Table
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid not null references public.subscription_plans(id),
  status public.subscription_status not null default 'inactive',
  stripe_customer_id text,
  stripe_subscription_id text unique,
  renewal_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Charities Table
create table public.charities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  description text not null,
  impact text not null,
  image_url text,
  website_url text,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. Charity Events Table
create table public.charity_events (
  id uuid primary key default gen_random_uuid(),
  charity_id uuid not null references public.charities(id) on delete cascade,
  title text not null,
  description text not null,
  event_date date not null,
  location text not null,
  created_at timestamptz not null default now()
);

-- 6. Charity Selections Table (minimum 10% contribution enforced by constraint)
create table public.charity_selections (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  charity_id uuid not null references public.charities(id),
  contribution_percent numeric(5,2) not null default 10.00 check (contribution_percent >= 10.00 and contribution_percent <= 100.00),
  updated_at timestamptz not null default now()
);

-- 7. Stableford Scores Table (1-45 range, one score per date per user)
create table public.scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  played_on date not null,
  stableford integer not null check (stableford between 1 and 45),
  created_at timestamptz not null default now(),
  unique(user_id, played_on)
);

create index idx_scores_user_played_on on public.scores(user_id, played_on desc);

-- Trigger: Automatically retain only the 5 newest scores per user (Rolling window)
create or replace function public.enforce_five_scores()
returns trigger language plpgsql security definer as $$
declare
  total_scores integer;
begin
  select count(*) into total_scores from public.scores where user_id = new.user_id;
  if total_scores > 5 then
    delete from public.scores
    where id in (
      select id from public.scores
      where user_id = new.user_id
      order by played_on asc, created_at asc
      limit (total_scores - 5)
    );
  end if;
  return new;
end;
$$;

create trigger trg_enforce_five_scores
after insert on public.scores
for each row
execute procedure public.enforce_five_scores();

-- 8. Draws Table (Monthly draws, 5 numbers, prize pool and rollover jackpot)
create table public.draws (
  id uuid primary key default gen_random_uuid(),
  month date not null unique,
  numbers integer[] not null check (array_length(numbers, 1) = 5),
  mode public.draw_mode not null default 'random',
  status public.draw_status not null default 'simulation',
  prize_pool numeric(12,2) not null default 0.00,
  jackpot_rollover numeric(12,2) not null default 0.00,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

-- 9. Draw Participants Table (Immutable snapshot of user ticket during the draw)
create table public.draw_participants (
  draw_id uuid references public.draws(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  ticket integer[] not null check (array_length(ticket, 1) <= 5),
  matches integer not null default 0,
  created_at timestamptz not null default now(),
  primary key(draw_id, user_id)
);

-- 10. Winners Table (Tiers 3, 4, 5 with prize splits)
create table public.winners (
  id uuid primary key default gen_random_uuid(),
  draw_id uuid not null references public.draws(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  tier integer not null check (tier in (3, 4, 5)),
  amount numeric(12,2) not null default 0.00,
  proof_status public.proof_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique(draw_id, user_id, tier)
);

-- 11. Winner Proofs Table (Audited scorecard/handicap proof)
create table public.winner_proofs (
  id uuid primary key default gen_random_uuid(),
  winner_id uuid unique not null references public.winners(id) on delete cascade,
  storage_path text not null,
  status public.proof_status not null default 'pending',
  admin_notes text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 12. Payouts Table
create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  winner_id uuid unique not null references public.winners(id) on delete cascade,
  amount numeric(12,2) not null default 0.00,
  status public.proof_status not null default 'pending',
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

-- 13. Donations Table (Separating subscription contributions from independent direct donations)
create table public.donations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  charity_id uuid not null references public.charities(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  source public.donation_source not null default 'subscription',
  created_at timestamptz not null default now()
);

-- Helper Functions
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Auto create profile on auth signup
create or replace function public.create_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', 'Digital Hero'),
    case
      when new.email ilike '%admin%' then 'admin'::public.app_role
      else 'subscriber'::public.app_role
    end
  )
  on conflict (id) do update
  set email = excluded.email;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.create_profile();

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.charities enable row level security;
alter table public.charity_events enable row level security;
alter table public.charity_selections enable row level security;
alter table public.scores enable row level security;
alter table public.draws enable row level security;
alter table public.draw_participants enable row level security;
alter table public.winners enable row level security;
alter table public.winner_proofs enable row level security;
alter table public.payouts enable row level security;
alter table public.donations enable row level security;

-- Policies
create policy "public can view active plans" on public.subscription_plans for select using (active = true);
create policy "public can read charities" on public.charities for select using (true);
create policy "public can read charity events" on public.charity_events for select using (true);

create policy "users can read own profile" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "users can update own profile" on public.profiles for update using (id = auth.uid() or public.is_admin());

create policy "users can read own subscription" on public.subscriptions for select using (user_id = auth.uid() or public.is_admin());
create policy "users can manage own scores" on public.scores for all using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
create policy "users can manage charity selection" on public.charity_selections for all using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());

create policy "public can view published draws" on public.draws for select using (status = 'published' or public.is_admin());
create policy "admin manages draws" on public.draws for all using (public.is_admin()) with check (public.is_admin());
create policy "admin manages charities" on public.charities for all using (public.is_admin()) with check (public.is_admin());
create policy "admin manages charity events" on public.charity_events for all using (public.is_admin()) with check (public.is_admin());

create policy "users can view draw entries" on public.draw_participants for select using (user_id = auth.uid() or public.is_admin());
create policy "users can view winners" on public.winners for select using (true);

-- Winner proof privacy: Only the winner and administrators can view and upload proofs
create policy "winner can view own proof" on public.winner_proofs for select using (
  exists (select 1 from public.winners w where w.id = winner_id and (w.user_id = auth.uid() or public.is_admin()))
);
create policy "winner can insert own proof" on public.winner_proofs for insert with check (
  exists (select 1 from public.winners w where w.id = winner_id and w.user_id = auth.uid())
);
create policy "admin can manage proofs" on public.winner_proofs for update using (public.is_admin()) with check (public.is_admin());

create policy "users can view own payouts" on public.payouts for select using (
  exists (select 1 from public.winners w where w.id = winner_id and (w.user_id = auth.uid() or public.is_admin()))
);
create policy "admin can manage payouts" on public.payouts for all using (public.is_admin()) with check (public.is_admin());

create policy "users can view own donations" on public.donations for select using (user_id = auth.uid() or public.is_admin());
create policy "users can record donations" on public.donations for insert with check (user_id = auth.uid() or public.is_admin());

-- Private Supabase Storage Bucket Setup for Winner Proofs
insert into storage.buckets (id, name, public)
values ('winner-proofs', 'winner-proofs', false)
on conflict (id) do nothing;

create policy "authenticated users can upload proof"
on storage.objects for insert to authenticated
with check (bucket_id = 'winner-proofs' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "winner and admin can view proof objects"
on storage.objects for select to authenticated
using (bucket_id = 'winner-proofs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- SEED DATA
insert into public.subscription_plans (name, interval, amount, discount_description)
values
  ('Monthly Hero', 'monthly', 12.00, 'Flexible monthly membership'),
  ('Yearly Hero', 'yearly', 120.00, 'Discounted annual plan (save £24/year)')
on conflict (interval) do update
set amount = excluded.amount, discount_description = excluded.discount_description;

insert into public.charities (id, name, category, description, impact, image_url, website_url, featured)
values
  ('11111111-1111-1111-1111-111111111111', 'Water for All', 'Clean Water', 'Funding durable solar-powered borehole wells and community training across sub-Saharan villages.', '£18 provides lifelong safe drinking water for one individual.', 'https://images.unsplash.com/photo-1538300342682-cf57afb97285?auto=format&fit=crop&w=1000&q=80', 'https://waterforall.org', true),
  ('22222222-2222-2222-2222-222222222222', 'Open Field Futures', 'Youth & Community', 'Opening safe athletic facilities, equipment libraries, and leadership mentoring for underprivileged youth.', '£25 funds a full month of active sports mentorship.', 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1000&q=80', 'https://openfieldfutures.org', true),
  ('33333333-3333-3333-3333-333333333333', 'Rewild Together', 'Climate & Nature', 'Restoring native woodlands, wetlands, and biodiversity corridors across devastated ecosystems.', '£12 protects and restores 10 square metres of natural habitat.', 'https://images.unsplash.com/photo-1497250681960-ef046c08a56e?auto=format&fit=crop&w=1000&q=80', 'https://rewildtogether.org', false),
  ('44444444-4444-4444-4444-444444444444', 'Clean Oceans Coalition', 'Oceans', 'Deploying interceptor barriers and ocean cleanup initiatives to remove plastic pollution from marine habitats.', '£15 clears 5kg of plastic waste before it reaches open ocean waters.', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1000&q=80', 'https://cleanoceans.org', false)
on conflict (id) do nothing;

insert into public.charity_events (charity_id, title, description, event_date, location)
values
  ('11111111-1111-1111-1111-111111111111', 'Clean Water Walkathon 2026', 'Annual 10km community walk to raise awareness and fund 5 new solar well boreholes.', '2026-10-15', 'Regent Park, London'),
  ('22222222-2222-2222-2222-222222222222', 'Youth Sports Open Day', 'Free clinics, sports drills, and inspirational speaker sessions for over 300 young athletes.', '2026-11-02', 'Manchester Sports Hub'),
  ('33333333-3333-3333-3333-333333333333', 'National Tree Planting Drive', 'Community volunteer tree planting day to establish 5,000 native oak and silver birch saplings.', '2026-11-20', 'Peak District Conservation Area')
on conflict do nothing;
