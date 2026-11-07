# V1-H.25 Search performance preparation

Adds three partial indexes to the published-card subset: a direction/type/term candidate index and two normalized German word indexes (term and curated plural). The SQL is staged only; the existing SECURITY INVOKER candidate remains staged, and the production RPC still uses SECURITY DEFINER.

**Limitations:** These indexes do not make the English reverse-translation semicolon split index-backed. The current OR expression may also prevent PostgreSQL from using expression indexes consistently. The fixture has only two cards, so CI verifies installation, idempotence and RLS visibility, **not latency or query-plan performance**. Do not enable the flag based on this PR. Benchmark realistic datasets with EXPLAIN (ANALYZE, BUFFERS) and plan an RLS-safe indexed term representation before deployment.
