# V1-G.7D.2D.3M — Response ordering and cookie race audit

## Scope
These tests cover the **pure distributed-refresh response decision** and static route invariants. They are not browser-level or multi-instance proof.

## Verified invariants
- A retryable distributed refresh returns HTTP 503 without rotating or clearing browser cookies.
- A successful distributed handoff must be re-verified against the original signed user identity before cookies are issued.
- Invalid provider pair shape cannot authorize cookie updates.
- New identity binding is issued for the newly rotated refresh token.

## Unresolved risks — do NOT enable distributed refresh
1. **Out-of-order HTTP responses:** Two responses can each set a valid but different refresh-token generation. Browser cookies use last-response-wins; a server-side HMAC binding does not provide monotonic browser cookie ordering. A future rollout needs a tested client request-serialization/epoch strategy and end-to-end browser tests.
2. **Legacy multi-instance invalid-token race:** The default process-local path clears cookies on provider 400/401/403. If another instance already rotated the same refresh token, this can sign the user out. Existing behavior is unchanged by this PR.
3. **Expired token and missing identity cookie:** Opt-in distributed mode returns retryable 503. No silent fallback to an unbound user.
4. **Redis lease expiry, provider latency, and handoff TTL:** Simulations are not live Upstash proof.
5. **Cross-instance logout races:** Logout and refresh responses can arrive in either order; browser-level sequencing needs verification.

## Acceptance gate for production
Do not enable `ENABLE_DISTRIBUTED_SESSION_REFRESH` until actual Redis connectivity, independent deployment workers, refresh/logout response-order tests, and safe browser-side sequencing have been demonstrated.
