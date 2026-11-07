# V1-H.29 live production audit — 2026-11-07

**Decision: NOT READY for production migration or flag activation.** This review used read-only Supabase advisor and SQL calls; no production DDL was executed.

## Observed findings
- Security advisor WARN: `public.lookup_published_card_indexed` remains SECURITY DEFINER and executable by both `anon` and `authenticated`. The staged H.26 invoker replacement is **not deployed**. The RPC is behind an off-by-default application feature flag, but its REST endpoint is directly callable.
- Security advisor INFO: `private.card_search_terms` has RLS enabled without a policy. This is intentional deny-all for API roles; keep schema access revoked.
- Security advisor WARN: leaked-password protection disabled. This requires a paid plan according to the owner's earlier decision; defer without treating it as fixed.
- Performance advisor INFO: `public.cards_published_lookup_idx` and `public.categories_parent_sort_idx` are unused in recorded stats. Do not drop them based on low-traffic statistics.
- The 10,000-card CI benchmark script produces EXPLAIN ANALYZE output, but this review did not establish p50/p95 or compare the legacy vs proposed RPC. Do not claim performance is proven.

## Exposure decision required
H.26 adds `public.published_card_search_terms` with SELECT access for anon/authenticated, protected by an EXISTS policy against published cards. That makes the **published normalized search terms directly queryable** through the Data API, not just the RPC. Before release, decide whether public vocabulary terms are acceptable to expose this way. If not, redesign as a server-only index and keep the public RPC behind a service-side API boundary.

## Gates remaining
1. Inspect real CI benchmark EXPLAIN output for index scans, elapsed time, and rows returned; repeat with realistic production-shaped data and concurrency.
2. Confirm cards publication RLS policy and grants before applying H.24/H.26. A SECURITY INVOKER RPC cannot read cards if the policy or SELECT grants are absent.
3. Rehearse a **committed** schema downgrade on a disposable clone. H.28 tested a transactional rollback, not a committed downgrade.
4. Verify backup restore, row counts, trigger ordering, and publication/draft isolation.
5. After explicit production approval, migrate, rerun advisors and parity tests, then separately enable the feature flag.

## References
- Security advisor remediation: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- Signed-in role: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- Performance advisor: https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index
