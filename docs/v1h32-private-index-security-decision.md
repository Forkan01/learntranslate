# V1-H.32 — Private index / public API security decision

**Chosen release candidate:** use H.24 SECURITY INVOKER RPC with H.25 partial indexes; do **not** install H.26 public derived-term table in production. Keep existing `private.card_search_terms` inaccessible to anon/authenticated. The Next.js server-side route remains the public application entrypoint; however, the invoker RPC itself is still directly callable through Supabase REST by anon/authenticated, returning only published card rows under cards RLS.

This removes the H.26 direct term-index enumeration surface and avoids the current public SECURITY DEFINER warning. It does **not** guarantee fast English reverse lookup at scale: H.24 may scan published cards and split translation senses; benchmark before enabling `CARD_INDEXED_SEARCH_ENABLED`. H.26 remains in CI as a historical experimental candidate, not a production deployment dependency.

## Deployment prerequisites
- Verify actual live `public.cards` SELECT policy and grants for anon/authenticated. The H.24 function is SECURITY INVOKER and must obey RLS.
- Confirm publication-only access with role-scoped tests, and verify full-card content is intended to be public.
- Obtain explicit approval before any production DDL. Stage H.24 then H.25 only, after backup validation.
- After deployment, rerun advisors and verify search parity. Leave feature flag off until performance validated.
- Do not run the H.26 or H.30 downgrade scripts against production.
