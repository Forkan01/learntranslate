# V1-H.27 production readiness gate

**Status: staged, no production DDL and no feature flag activation.**

## Install order
1. Verify a fresh backup, current cards count and existing grants/policies in production.
2. Review H.24 SECURITY INVOKER replacement and cards SELECT policy. This grants anon/authenticated published-card visibility; ensure this is intended for the product and that no sensitive draft fields are exposed.
3. Review H.25 partial indexes. Existing indexes can be redundant; validate plans before installing.
4. Review H.26 derived public term index, private trigger and RPC. Public normalized terms are readable by anon; confirm the publication policy and REST exposure are acceptable.
5. After approval, execute in a controlled maintenance window with a verified rollback plan; **do not use the SQL test scripts against production**.

## Mandatory gates
- CI postgres-integration and indexed-release-bundle pass, including publication lifecycle and rollback rehearsal.
- Run Supabase security and performance advisors; resolve or explicitly accept findings. Inspect public RPC privileges, RLS and policy definitions, and check for leaked draft data.
- Verify all 24 existing cards and expected published/draft counts are preserved; verify trigger sync after INSERT/UPDATE/DELETE on a disposable clone.
- Benchmark representative dataset (at least 10k synthetic cards) using EXPLAIN (ANALYZE, BUFFERS) for English reverse, German noun article, plural, sentence, no-match and mixed types. Record p50/p95 latency and planner index usage; the 2-card CI fixture is not a performance benchmark.
- Rollback rehearsal is transactional **data** rollback only; it does not prove a full schema rollback. A complete schema downgrade must restore the previous RPC definition, remove the new trigger/table/policy/indexes in dependency order, and restore prior permissions. Test downgrade on a disposable database before production.
- Activate CARD_INDEXED_SEARCH_ENABLED only after production parity and rollback verification, with a quick disable path.

## Known blocker
H.26 exposes published normalized search terms via a public table. Before deploying, confirm that this is an acceptable product API and that the cards RLS policy is restricted to published content. The H.26 trigger depends on the existing private trigger's alphabetical execution order. Confirm this invariant with pg_trigger before rollout.
