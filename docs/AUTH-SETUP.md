# Admin auth setup (NextAuth v5 · Resend magic link)

The `/admin` tool is gated by an email **magic link**. One-time setup:

## 1. Environment variables

Add to `.env.local` (and to Vercel project env for production):

```bash
# Auth.js session signing secret — generate with: openssl rand -base64 32
AUTH_SECRET=...

# Only these emails may sign in (comma-separated). EMPTY = nobody can sign in.
AUTH_ALLOWLIST=you@example.com

# Resend (https://resend.com) — magic-link delivery
RESEND_API_KEY=re_...
# Must be a verified Resend sending domain/address:
AUTH_EMAIL_FROM=Oction <login@oction.fr>
```

Already present and reused by the adapter (no action needed if set):
`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

## 2. Create the Auth.js schema in Supabase

Run [`supabase/migrations/0001_authjs_next_auth_schema.sql`](../supabase/migrations/0001_authjs_next_auth_schema.sql)
once in **Dashboard → SQL Editor → New query**.

## 3. Expose the `next_auth` schema

**Dashboard → Settings → API → Exposed schemas** → add `next_auth` → Save.
(The `@auth/supabase-adapter` reaches the tables through PostgREST with the
service-role key; without this the adapter 404s.)

## 4. Verify your Resend sending domain

In Resend, verify the domain used in `AUTH_EMAIL_FROM` (e.g. `oction.fr`) so the
magic-link emails aren't rejected. Until verified you can use Resend's
`onboarding@resend.dev` for testing.

## How it works

- `auth.ts` — Auth.js config: Resend provider + Supabase adapter, JWT sessions,
  `signIn` callback enforces `AUTH_ALLOWLIST` (fail-closed).
- `proxy.ts` — optimistic redirect: any `/admin/**` request without a session
  cookie → `/admin/login`.
- `lib/auth/dal.ts` — `requireAuth()` (admin layout + pages) and `getApiSession()`
  (route handlers, return 401) do the authoritative server-side check.

## Local testing without email

Set `AUTH_ALLOWLIST` to your email. Sign-in still needs a working
`RESEND_API_KEY` to deliver the link. To exercise the gate only (redirect
behavior), no Resend key is required — `/admin/**` will simply redirect to
`/admin/login`.
