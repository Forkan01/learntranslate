# V1-H.7 — staged DB-side search

This PR **does not change production search behavior** or apply SQL automatically.

The SQL file defines a read-only, SECURITY INVOKER PostgREST RPC for published German→English cards, including English reverse senses and German noun forms. Existing RLS still applies. Exact primary search keys remain handled by the existing indexed `search_key` lookup.

## Rollout gate

1. Review the SQL and test against the current published cards in a transaction.
2. Verify RLS with anonymous role, incorrect noun articles, plurals, semicolon-separated English senses, and nonpublished cards.
3. Compare Unicode normalization semantics against TypeScript `normalizeSearchTerm` (NFKC and locale case folding). PostgreSQL lowercasing is **not fully equivalent**, so do not switch the endpoint until verified.
4. Only after validation, deploy an application change using `/rest/v1/rpc/lookup_published_card_fallback`, replacing the 5,000-row scan.

**No schema changes or deployments occur from merging this documentation-only PR.**
