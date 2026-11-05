# V1-G.7D.2D — cross-instance refresh reliability

## Current boundary
The SHA-256 keyed singleflight in `refresh-singleflight.ts` is process-local. Concurrent Vercel instances can independently redeem the same rotating Supabase refresh token. This change does **not** solve cross-instance coordination or make authentication available during an outage.

## D.2D.1: honest retry UI
A 503 `{ signedIn: false, retryable: true }`, malformed response, or network failure now shows a neutral session-unavailable banner and a manual Retry button, **not** a signed-out verdict. Only a successful verified GET displays signed-in. Explicit invalid credentials still clear cookies server-side. Sign-out remains an explicit action.

## Proposed D.2D.2 (requires isolated LearnTranslate Redis)
Before implementing distributed refresh locking, provision a **separate** LearnTranslate Redis database. Do not reuse DOT AI's database. Design an atomic per-refresh-token keyed lease and short-lived encrypted result handoff, including fencing/owner checks, bounded TTL, lost-lock recovery, retries, and tests with multiple independent workers. Never persist plaintext refresh tokens or return unverified credentials. Evaluate Supabase refresh-token reuse behavior and whether a distributed lock alone can safely coordinate cookie rotation across instances. Keep public AI generation disabled.

## Manual checks
1. Sign in on PR preview, reload and confirm signed-in banner.
2. Sign out and confirm banner disappears.
3. A transient auth outage should show a retry message, not a false signed-out banner. This third case is not necessary to simulate manually.
