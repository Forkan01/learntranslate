# V1-H.30 committed downgrade rehearsal

The disposable PostgreSQL integration job now **commits** the removal of the H.26 public term table, sync trigger/function and replacement RPC; restores the H.16 RPC; asserts original card count; then reinstalls H.26 and verifies anonymous lookup and draft isolation. This is stronger than H.28's transaction rollback test.

**Not approved for production execution.** The downgrade temporarily restores the H.16 SECURITY DEFINER RPC and thus reintroduces its advisor warnings. In production, a safer emergency response is to leave the app feature flag disabled, then execute an approved migration plan only after backup/restore testing and explicit approval. This test does not verify restoration of all grants/policies on a live schema, production data parity, or a real backup restore.

Production indexed search stays disabled. Read-only review of live RLS and index usage remains required before release.
