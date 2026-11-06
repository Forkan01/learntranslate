# V1-G.7D.2D.7 — Authentication verification gate

## Reviewed
- Email callback strips URL fragment, validates the provider user, and POSTs credentials to the session endpoint.
- Session cookies are HttpOnly, Secure, SameSite=Lax; GET revalidates with the server.
- Session checks are serialized in-tab and with Web Locks where available.
- UI ignores outdated GET results, rechecks on visibility/online events, and treats uncertain failures as retryable.
- Sign-out clears cookies and attempts provider revocation; the response reports whether revocation succeeded.
- Cross-tab messages trigger server revalidation, not automatic authentication changes.
- Stale callback marker is browser-only and cannot guarantee atomic sign-out across all tabs or servers.

## Release blockers / limitations
1. **Do not enable public AI generation solely based on these UI tests.** Run real-browser multi-tab tests and deployed integration checks first.
2. Verify refresh-token rotation with two independent server instances before enabling `ENABLE_DISTRIBUTED_SESSION_REFRESH`; keep it disabled until then.
3. Confirm sign-out semantics: the server clears browser cookies even if provider revocation fails (`serverRevoked: false`). UI must not imply global revocation.
4. LocalStorage marker and Web Locks are best-effort; unavailable storage or browsers without Web Locks can still race.
5. Confirm email callback, expired access token, refresh recovery, sign-out, reload, offline/online, and simultaneous tabs manually in a staging deployment.

## Manual smoke checklist
- Open a fresh email link: sign-in succeeds; URL contains no tokens afterward.
- Reload Search: session still appears signed in when valid.
- Expire access token: refresh succeeds or a retryable message appears; never false sign-out on 503.
- Disconnect/reconnect: session rechecks automatically.
- Sign out in one tab: other tab rechecks; stale callback queued before sign-out does not POST after the marker changes.
- Repeat in a browser without Web Locks or with storage blocked; note residual limitations.
- Ensure public generation remains disabled until independent security and cost-control gates pass.

This document records code-level review and CI checks, **not** evidence of live deployment verification.
