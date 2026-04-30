-- The upsert_catalog_contribution RPC uses ON CONFLICT ((lower(name)), (lower(city)), year)
-- WHERE status = 'pending'. This requires a matching partial unique index.
-- Without it, every RPC call throws 42P10 and silently fails.

CREATE UNIQUE INDEX IF NOT EXISTS pending_catalog_contributions_dedup_idx
  ON pending_catalog_contributions (lower(name), lower(city), year)
  WHERE status = 'pending';
