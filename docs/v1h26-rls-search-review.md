# V1-H.26 RLS-backed exact term index

A public, **read-only-to-API-roles** derived term table mirrors the existing private curated term index. The table has RLS enabled; its SELECT policy verifies that the referenced card is published, and the RPC joins public.cards under that table's own RLS. The public RPC is SECURITY INVOKER, eliminating the public SECURITY DEFINER warning when installed.

The trigger is in private schema and is not exposed as a callable public API. The second trigger name sorts after the existing cards_sync_search_terms trigger, so it copies the refreshed private terms after each card change. A backfill copies current terms.

**Privacy tradeoff:** published search terms are directly readable through the public REST API, not just through the RPC. This is acceptable only if published vocabulary and its normalized terms are intended to be public. No draft terms should be indexed. Validate the public schema exposure policy and security advisors before production deployment.

**Not yet deployed.** Verify the PostgreSQL CI suite, add larger-scale EXPLAIN ANALYZE benchmarks and test rollback before activating the indexed-search flag. The 24-card production dataset is too small for a meaningful latency comparison.
