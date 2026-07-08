-- Investor-contact leads (the "Espace investisseur" form).
-- Run once in the Supabase SQL editor. Inserts happen server-side with the
-- service-role key (RLS stays on; no public/anon access).

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nom text not null,
  email text not null,
  telephone text,
  message text,
  source text not null default 'investisseur',
  averti boolean not null default false
);

alter table public.leads enable row level security;
-- No policies = no anon/public access. The service-role key bypasses RLS.
