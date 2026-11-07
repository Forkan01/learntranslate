# V1-H.19 — Existing event trigger privilege hardening

Read-only inspection of production identified `public.rls_auto_enable()`, a `SECURITY DEFINER` **event trigger function** owned by `postgres`. It is invoked by the enabled `ensure_rls` trigger on `ddl_command_end` to enable RLS on newly created public tables. Its function ACL is NULL, so PostgreSQL's default PUBLIC EXECUTE privilege applies; both anon and authenticated inherit it. This explains two security advisor warnings. The function is not an ordinary SQL-callable RPC (it returns `event_trigger`), but unnecessary API EXECUTE privileges should still be revoked.

## Proposed action — requires approval

Run `docs/sql/v1h19-revoke-event-trigger-execute.sql` in production only after review. It checks the expected trigger identity and revokes EXECUTE from PUBLIC, anon and authenticated, then verifies privileges. It does not remove the event trigger, change RLS policies, or modify card data.

## Verification and rollback

After approved execution, query `has_function_privilege('anon', 'public.rls_auto_enable()', 'EXECUTE')` and the authenticated equivalent (both should be false); verify `ensure_rls` remains enabled; rerun Supabase security advisors. Test any event-trigger behavior in a disposable database first, not by creating tables in production.

If legitimate callers unexpectedly require the function, assess dependencies before restoring any privileges. Avoid granting EXECUTE to PUBLIC again without a security review.

Leaked-password protection is excluded from this milestone because it requires a paid plan for this project.

**No production changes in this PR.**
