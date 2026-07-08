-- Auth.js (NextAuth v5) schema for the @auth/supabase-adapter.
--
-- Run ONCE in the Supabase SQL editor (Dashboard → SQL Editor → New query),
-- then add `next_auth` to Settings → API → "Exposed schemas" so the
-- service-role client can reach these tables. See docs/AUTH-SETUP.md.
--
-- Uses gen_random_uuid() (built into Supabase via pgcrypto) — no uuid-ossp needed.

create schema if not exists next_auth;
grant usage on schema next_auth to service_role;
grant all on schema next_auth to postgres;

-- Users --------------------------------------------------------------------
create table if not exists next_auth.users (
  id uuid not null default gen_random_uuid(),
  name text,
  email text,
  "emailVerified" timestamptz,
  image text,
  constraint users_pkey primary key (id),
  constraint users_email_key unique (email)
);
grant all on table next_auth.users to postgres, service_role;

-- Sessions (unused under JWT strategy, kept for adapter completeness) --------
create table if not exists next_auth.sessions (
  id uuid not null default gen_random_uuid(),
  expires timestamptz not null,
  "sessionToken" text not null,
  "userId" uuid,
  constraint sessions_pkey primary key (id),
  constraint sessions_sessionToken_key unique ("sessionToken"),
  constraint "sessions_userId_fkey" foreign key ("userId")
    references next_auth.users (id) on delete cascade
);
grant all on table next_auth.sessions to postgres, service_role;

-- Accounts ------------------------------------------------------------------
create table if not exists next_auth.accounts (
  id uuid not null default gen_random_uuid(),
  type text not null,
  provider text not null,
  "providerAccountId" text not null,
  refresh_token text,
  access_token text,
  expires_at bigint,
  token_type text,
  scope text,
  id_token text,
  session_state text,
  oauth_token_secret text,
  oauth_token text,
  "userId" uuid,
  constraint accounts_pkey primary key (id),
  constraint "accounts_userId_fkey" foreign key ("userId")
    references next_auth.users (id) on delete cascade
);
grant all on table next_auth.accounts to postgres, service_role;

-- Verification tokens (the magic-link tokens) -------------------------------
create table if not exists next_auth.verification_tokens (
  identifier text,
  token text,
  expires timestamptz not null,
  constraint verification_tokens_pkey primary key (token),
  constraint token_identifier_unique unique (token, identifier)
);
grant all on table next_auth.verification_tokens to postgres, service_role;
