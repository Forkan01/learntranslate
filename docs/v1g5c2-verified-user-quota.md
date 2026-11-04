# V1-G.5C.2 — Verified-user quota admission foundation

This adds `POST /api/cards/quota-probe`, a **disabled-by-default** test endpoint that accepts only a same-origin request with a valid HttpOnly access-token cookie. It calls Supabase Auth to verify the user UUID, hashes that server-verified UUID into an opaque Redis actor ID, and uses the existing atomic Redis budget reservation (global 10/day, 2/minute; per actor 3/day, 1/minute). No client-provided actor ID is accepted.

**No AI generation is performed** and no card is saved. Each successful probe **consumes a real quota slot**, so leave `ENABLE_VERIFIED_QUOTA_PROBE` unset/false in production. No UI calls this endpoint. Existing private admin generation route remains unchanged.

This does **not** yet enable public generation or provide a secure complete production policy. The cookie access token may expire until the existing session refresh route is called; add robust refresh/rotation coordination before wiring generation. Before launch: validate Redis integration and parallel requests, add IP/network abuse prevention, cost-based provider spending caps, token revocation, and use verified user identity on the eventual public generation endpoint. Account farming can evade per-user quotas.

Contract tests are static checks; runtime auth/Redis integration is pending. No live AI calls were made.
