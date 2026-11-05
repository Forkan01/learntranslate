# V1-G.7D.2D.3 — distributed refresh protocol (design gate)

**Status:** design only. No Redis coordination is enabled by this PR. Public AI generation remains disabled.

## Existing failure mode

`singleFlightRefresh` coalesces requests only inside one Node process. Two Vercel instances can receive the same stale refresh cookie and both attempt Supabase token rotation. A successful rotation on one instance can race a rejected rotation on another, causing the losing response to clear cookies or overwrite newer cookies. A Redis lock alone does not fix this: waiters need a safe way to receive the successful token pair, and late HTTP responses can still overwrite newer cookies.

## Proposed protocol

1. **Configuration and isolation.** Require valid HTTPS Upstash REST credentials, plus a separate 32-byte-or-longer random encryption key (`SESSION_REFRESH_HANDOFF_KEY`) for the handoff. Do not reuse the Redis REST token as an encryption key. Namespace all keys `lt:auth:refresh:v1:`; no scans, flushes, or unbounded key lifetimes. Preview and production should use isolated namespaces/databases before concurrency tests.
2. **Opaque identity.** Derive a per-refresh-token identifier using HMAC-SHA-256 with a separate server secret (domain-separated from the encryption key). Do not store raw refresh tokens in keys, logs, or lock values. The HMAC key must be identical on all instances of one environment.
3. **Atomic ownership.** Attempt `SET leaseKey ownerNonce NX PX leaseMs`. A contender that fails to acquire polls a bounded number of times for a completed handoff. Owner release and publication must verify ownership atomically (Lua). Lease expiry does not grant an expired owner permission to publish. Owner nonces must be unpredictable.
4. **Encrypted handoff.** After Supabase returns a validated pair, encrypt the access/refresh tokens and expiry with authenticated AES-256-GCM using a fresh random IV and AAD bound to the token identifier and protocol version. Store only ciphertext and metadata with a short TTL (e.g. 15 seconds). Other workers decrypt, validate shape, and verify the returned access token against Supabase before setting cookies. Never return ciphertext or token material to browser JSON.
5. **Ordering.** Publish handoff while still holding the lease, using one atomic ownership-checking script. If ownership was lost, do not publish. Do not issue a second refresh while another lease is active. On timeout or uncertain state, return retryable 503 and preserve cookies.
6. **Invalid-token handling.** A 400/401/403 from Supabase after a competing rotation must not immediately clear cookies if a peer lease or handoff may exist. Recheck handoff/lease first. Only clear on a definitive invalid token after coordination establishes no in-flight or completed rotation; otherwise return retryable 503.
7. **Fallback and rollout.** Missing Redis, encryption, or HMAC config must fail closed for distributed mode (503 retaining cookies), not silently use process-local refresh across instances. Gate with `ENABLE_DISTRIBUTED_SESSION_REFRESH=true` and keep off until tests and a live isolated Redis verification pass.
8. **Response races.** Two HTTP responses can arrive out of order; tests must cover stale 503 responses not setting cookies, and invalid responses not clearing a successful refresh. A stale successful response should not overwrite a newer rotated pair. Confirm browser cookie behavior with multi-instance simulation before rollout.

## Acceptance tests required before enabling

- Two independent workers receive same refresh token: exactly one provider refresh; both can adopt a verified encrypted handoff.
- Late owner cannot publish after lease expiry; new owner can recover.
- Redis timeout, bad credentials, malformed response, lost lock, missing secrets: retryable 503; refresh cookies retained.
- Supabase 429/5xx and network timeout: retryable 503; no false signed-out verdict.
- Concurrent invalid-token and successful-rotation race: no premature cookie clearing.
- Tampered ciphertext, mismatched AAD, wrong key: reject; never set cookies.
- TTL expiry and cleanup; no plaintext token in Redis payloads, keys, or logs.
- Preview and production Redis isolation confirmed; public generation stays disabled.

## Next implementation increment

Implement the Redis lease and encrypted handoff primitives with mocked independent-worker tests **without** wiring the auth route. Then perform isolated live Redis verification, review race handling, and only then gate a route integration.
