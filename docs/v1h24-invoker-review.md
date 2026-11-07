# V1-H.24 least-privilege search candidate

Replace the existing public SECURITY DEFINER RPC with SECURITY INVOKER, querying public.cards under its published-only RLS policy. The existing private index and trigger remain installed but are not used by this candidate; therefore **the candidate is not yet proven to have indexed performance**. Do not enable CARD_INDEXED_SEARCH_ENABLED based on this PR alone. Compare results, benchmark large datasets, and design a safe expression index or another RLS-compatible index strategy before activation. The existing paginated JS fallback stays in place.

The SQL is staged only. GitHub Actions tests as the anon database role against a disposable PostgreSQL fixture. Production remains unchanged until separately approved.
