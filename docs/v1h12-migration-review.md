# V1-H.12: migration candidate and security review

**Not applied.** This SQL is a review candidate, not a completed production migration. It uses a private schema, a composite B-tree index, a trigger for card updates/deletes, and a non-mutating backfill. No API switch is included.

## Before production
- Run in staging transaction and verify function creation, trigger syntax, insert/update/delete, rollback, RLS and backfill counts.
- Resolve the private helper's SECURITY DEFINER privilege boundary before exposing an RPC. Public RPC should be SECURITY INVOKER and only return rows visible under cards RLS.
- Compare generated terms against existing JS for all published cards, including wrong articles, punctuation, whitespace, Unicode and duplicate senses.
- Review `public.lookup_normalized_term` dependency: this helper was staged in V1-H.8 but **has not been installed in production**. It must be installed first in the same audited migration.
- Add migration execution tests to CI and verify SQL plans at scale. This draft does not yet guarantee Unicode or full search-semantic parity.

## Existing unrelated security advisor findings (observed 2026-11-07)
- `public.rls_auto_enable()` is SECURITY DEFINER and callable by anonymous and authenticated roles; review and revoke direct EXECUTE if not required.
- Leaked-password protection is disabled in Supabase Auth.

These findings were observed, not modified by this PR.
