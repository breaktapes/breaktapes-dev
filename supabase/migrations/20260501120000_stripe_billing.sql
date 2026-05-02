-- Add Stripe billing columns to user_state
alter table public.user_state
  add column if not exists stripe_customer_id    text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_price_id       text,
  add column if not exists pro_expires_at        timestamptz;

-- Unique index so we can look up user by Stripe customer ID
create unique index if not exists user_state_stripe_customer_idx
  on public.user_state (stripe_customer_id)
  where stripe_customer_id is not null;
