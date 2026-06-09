-- Retention email pipeline: race-day reminders + weekly digest.
--
-- Adds the columns the daily cron (health-proxy scheduled handler) reads to
-- decide who to email, plus an idempotency/audit table so a given reminder or
-- weekly digest is sent at most once.
--
-- Opt-in defaults to TRUE (decision: default-ON with one-click unsubscribe).
-- The client writes email + email_opt_in through the /api/sync Worker; the
-- unsubscribe link flips email_opt_in to false by token.

-- ── user_state: email + opt-in + unsubscribe token ──────────────────────────
alter table public.user_state
  add column if not exists email             text,
  add column if not exists email_opt_in      boolean not null default true,
  add column if not exists unsubscribe_token uuid    not null default gen_random_uuid();

-- Unsubscribe token must be unique (it's the only credential on the unsubscribe
-- link). Partial-safe: gen_random_uuid() defaults guarantee non-null distinct.
create unique index if not exists user_state_unsubscribe_token_idx
  on public.user_state (unsubscribe_token);

-- The cron filters on these — index keeps the daily scan cheap as users grow.
create index if not exists user_state_email_optin_idx
  on public.user_state (email_opt_in)
  where email is not null;

-- ── reminder_sends: idempotency + audit ─────────────────────────────────────
-- One row per (user, kind, race). kind is 'reminder' for race-day reminders and
-- 'digest_<ISO-week>' for the weekly digest. race_id is '' for digests. The PK
-- makes a re-send a no-op (the cron claims a slot with ignore-duplicates).
create table if not exists public.reminder_sends (
  user_id  text        not null,
  kind     text        not null,
  race_id  text        not null default '',
  sent_at  timestamptz not null default now(),
  primary key (user_id, kind, race_id)
);

-- Service-role only (the cron). No anon/authenticated access.
alter table public.reminder_sends enable row level security;
