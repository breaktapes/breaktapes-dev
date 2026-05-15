-- Remove Stripe billing columns added in 20260501120000 (reverted)
alter table public.user_state
  drop column if exists stripe_customer_id,
  drop column if exists stripe_subscription_id,
  drop column if exists stripe_price_id,
  drop column if exists pro_expires_at;

drop index if exists public.user_state_stripe_customer_idx;
