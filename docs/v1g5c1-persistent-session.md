# V1-G.5C.1 — Persistent session foundation

Email callback verifies the Supabase access token and exchanges access/refresh credentials with a same-origin server endpoint. Server stores both as Secure, HttpOnly, SameSite=Lax cookies. GET /api/auth/session checks the access token with Supabase and refreshes when expired. DELETE clears cookies. Search shows a small signed-in indicator and sign-out control. Callback heading contrast is corrected.

**Important:** sign-out clears local cookies but does not revoke a stolen refresh token at Supabase; refresh rotation may race if multiple tabs refresh simultaneously. Follow-up should implement server-side revocation and refresh serialization. The GET session check contacts Supabase and may fail closed during provider outages. Session cookies last up to 7 days (refresh) or access expiry; do not claim indefinite login.

**Security:** never expose cookies to JS; reject cross-origin session writes using the Origin header. Configure `NEXT_PUBLIC_APP_URL` for preview environments if testing outside the production origin. No public AI generation or quotas are enabled.

**Verification:** GitHub CI is source-contract-only. After merge, test a fresh magic link, refresh, reload, sign-out, and multi-tab behavior on a real deployed environment. No live auth requests were made by this PR.
