# V1-H.13 database migration preflight

CI now runs executable static migration checks. These do **not** prove SQL executes successfully; staging SQL execution, permission checks, and end-to-end matching remain release blockers.

## Read-only live data probe (2026-11-07)
The existing 24 published German→English cards produced **41 candidate English-sense and exact-German-term entries**, with 24 distinct card IDs and zero blank entries, using a read-only query. This is a lower bound, not a complete backfill count (noun variants are additional). No schema or data was modified.

## Critical remaining gaps
1. V1-H.12 references `public.lookup_normalized_term`, which is not installed by that candidate. Bundle and test the dependency.
2. The private SECURITY DEFINER UUID lookup has no public callable wrapper. A safe invoker-visible RPC must enforce published-card RLS and deterministic ordering.
3. SQL matching needs parity tests for German noun/article and plural cases, JS locale lowercasing, and empty/invalid content.
4. Test migration on a disposable staging DB, including transaction rollback and insert/update/unpublish/delete trigger paths. Static CI alone cannot validate PostgreSQL syntax or runtime behavior.
5. Review Supabase advisor warnings separately; do not change unrelated Auth or trigger configuration without approval.

**Release gate: BLOCKED**. Do not run candidate on production or enable API flag yet.
