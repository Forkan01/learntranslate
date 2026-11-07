# V1-H.21 — Production indexed-search deployment candidate

**Status: candidate only; NOT applied to Supabase.** The feature flag remains disabled.

The exact SQL artifact is `docs/sql/v1h21-indexed-install-transaction.sql`. It combines the reviewed normalization helper, H.12 index and trigger/backfill, and H.16 published-only RPC in one transaction, with fail-fast schema checks and post-install privilege checks. GitHub Actions runs the **exact same file** against a fresh disposable PostgreSQL 17 database.

Before executing on production, obtain explicit approval, capture a database backup, inspect existing objects for conflicts, run the H.17 read-only preflight, and review the security advisor. The public RPC uses SECURITY DEFINER and manually filters published cards; its public execution is intentional but requires a separate security review. The H.12 unused private UUID helper remains inaccessible to API roles.

After approved deployment: verify published counts and index coverage, test RPC with the anon key, compare results to legacy search for representative real cards, then consider enabling `CARD_INDEXED_SEARCH_ENABLED=true` in a separately approved rollout. If results differ, leave the flag off. To roll back the application immediately, unset the flag. Database rollback requires a separately reviewed migration; never delete card data.
