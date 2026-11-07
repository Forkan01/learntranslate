# V1-H.17 — Indexed-search release gates (NOT deployed)

## Preflight

1. Keep `CARD_INDEXED_SEARCH_ENABLED` unset (default off). Verify the current search endpoint still works.
2. Run `docs/sql/v1h17-production-preflight.sql` **read-only** against production to check RLS, role availability, and card uniqueness. Record published-card count and database schema snapshot.
3. Confirm actual production `public.cards` columns and content shapes match the staged SQL; review Supabase security advisors. Review the SECURITY DEFINER public RPC with a database administrator: it bypasses RLS, so its published-only predicate and privileges are security-critical.
4. Use GitHub Actions' isolated PostgreSQL 17 job to test the ordered sequence: normalization helper from H.7 **only**, H.12 private index and trigger, H.16 public RPC, then H.14/H.16/H.17 assertions. **Do not install the separate H.7 fallback RPC.**
5. Run representative published-card parity tests for reverse senses, nouns, wrong articles, plurals, and Unicode before considering activation. Synthetic fixture checks are necessary but not sufficient for production parity.

## Controlled deployment (requires explicit approval)

- Obtain approval for production DDL separately. Apply in one transaction if feasible: helper → private index/backfill → public RPC. Take a backup/snapshot first and inspect existing function/trigger name conflicts. Validate row counts and privileges after commit.
- Keep the feature flag **off** during and immediately after migration. Test RPC as anon/authenticated and verify draft cards never appear. Ensure no access to `private` schema is granted to API roles.
- Enable the flag only after verifying the live database and API results match. Observe errors, latency, and search quality.

## Rollback

- **Immediate:** unset `CARD_INDEXED_SEARCH_ENABLED` and redeploy application configuration; the old paginated lookup remains available.
- If DDL must be reverted after validation, revoke execute on the indexed RPC and remove it only after ensuring no clients depend on it. Do not drop the private index or triggers while live clients may still call them. Coordinate a separate reviewed rollback migration.
- **Do not delete or rewrite `public.cards` data.**

**Status:** documentation and disposable CI tests only. No production DDL authorized or executed.
