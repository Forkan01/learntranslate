# V1-H.28 benchmark and schema downgrade verification

## Automated CI gates
PostgreSQL 17 integration now loads **10,000 synthetic published cards** after the existing H.27 assertions and checks reverse translation, German article, plural and no-match results as anon. EXPLAIN (ANALYZE, BUFFERS) records actual execution plans and timings in the CI log. It is **not** a statistically reliable p50/p95 production benchmark: hosted CI resources fluctuate, and SQL functions may be inlined. Review plans for use of the term index and rerun benchmarks in a production-like environment before activation.

Schema rollback rehearsal runs in a transaction: drops the H.26 trigger/function/policy/table, restores the old H.16 RPC, checks the downgrade, rolls back, and verifies the H.26 schema and invoker RPC are restored. This tests transactional DDL reversibility, **not** a complete production downgrade after a committed migration.

## Security and release blockers
- H.26 creates a publicly queryable table of **published** normalized search terms. Verify public REST exposure and whether exposing all published terms is acceptable.
- Inspect live Supabase security/performance advisors and existing cards RLS/grants before any production DDL.
- Validate parity on a copy of production data and record latency under representative concurrency.
- Preserve a verified backup and a tested committed downgrade script before deployment.
- Keep CARD_INDEXED_SEARCH_ENABLED=false until explicit approval and verified production rollout.

No production database mutation or feature-flag change is included.
