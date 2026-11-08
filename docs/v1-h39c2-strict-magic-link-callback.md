# H.39C.2 — One-email-safe magic-link callback

## Why we changed the existing callback

The local Next.js sign-in showed “No sign-in token found” even after
Supabase recorded a login. The original React `useEffect` read and
immediately scrubbed the URL fragment. React StrictMode deliberately
replays effects in development: the first effect was cancelled, while
the second found no tokens. This is a strong plausible explanation,
**not proof that an email scanner could not also have consumed the link**.

This PR captures the fragment once in an in-memory React ref, reuses it
on effect replay, and immediately removes the sensitive fragment from
the browser URL. There is no token storage in localStorage/sessionStorage.

It also avoids spending another sign-in email if:
- `GET /api/auth/session` already confirms an authenticated browser.
- The session preflight is inconclusive (for example, a 503).
- The callback is reopened without the original URL fragment but a
  session already exists.

After Supabase validates the email, the original server session POST
still binds and rotates the token pair. The callback now confirms the
HttpOnly browser session with a fresh no-email GET before stating
**Signed in successfully**.

## Supabase restrictions

This project uses Supabase's built-in email sender with a user-reported
limit of **two sign-in emails per hour**. Each magic link is single-use.
This milestone does not configure SMTP, change email templates, issue
auth tokens, change RLS or bypass the existing admin identity gate.

**Do not request an email until the zero-email preflight is complete.**

## Preflight (zero email sends)

1. Switch to the branch and run the local Node suite, TypeScript, lint
   and production build. If standalone `tsc` complains about a stale
   deleted route in `.next/types`, run `npm run build` **before** `tsc`.
2. Confirm `.env.local` (do not publish or paste this file) has:
   - `ENABLE_LEARNTRANSLATE_ADMIN=true`
   - `LEARNTRANSLATE_ADMIN_USER_ID=` the UUID for the existing Auth user
   - `NEXT_PUBLIC_APP_URL=http://localhost:3000`
   - The existing Supabase project URL and publishable key.
3. In the Supabase dashboard, check **Authentication → URL Configuration**:
   `http://localhost:3000/auth/callback` must be an allowed redirect.
   This is a read-only check; the previous local redirect was working.
4. Stop `npm run dev` and run a *production-mode local server* after
   building:

```powershell
npm run build
npx tsc --noEmit
npm run start
```

The production-mode server avoids React development's extra effect
replay, giving us a controlled one-shot browser test.

5. In **Chrome on the same computer and same browser profile**, open
   `http://localhost:3000/api/auth/session`. It should return
   `{"signedIn":false}` if not signed in, or `{"signedIn":true}` if
   the browser already has a valid session. A 503 or unexpected result
   is a STOP sign; no email should be sent.
6. In the same browser open `http://localhost:3000/api/admin/access`.
   If signed in and authorized, it returns `{"authorized":true}` — no
   email required. If signed out, it returns `{"authorized":false}`
   with HTTP 401 (admin enabled).

## Exactly one email attempt — only after preflight passes

1. Open `http://localhost:3000/search`, search an unpublished term,
   click **Sign in (preview)**, enter the same existing Supabase email.
2. Click **Send sign-in link ONCE**. The form checks your existing
   session first and refuses to spend an email on an uncertain result.
3. Open the new magic link once in the same Chrome browser. Avoid link
   previews and other devices. Never paste the token-bearing link in chat.
4. Callback should say:
   **Signed in successfully! Your browser session is confirmed.**
5. Open the local `/api/admin/access` endpoint in the same browser.
   Expected: `{"authorized":true}`. Then open `/admin`.

If the callback reports any failure, **do not request the second email**.
First inspect `/api/auth/session` and `/api/admin/access` and share
only the HTTP statuses and redacted error messages. Never share actual
tokens, cookies, sign-in email URLs, or `.env.local` contents.

The card dashboard remains read-only and may show a database
unavailable message until the separately gated private card-read
configuration is enabled.

## Laptop test commands

```powershell
git fetch origin
git switch feature/v1-h39c2-email-otp-session-recovery
git pull --ff-only
node --test tests/v1h39c2-strict-magic-link-callback.test.mjs
node --test tests/v1h39c2-one-email-preflight.test.mjs
node --test tests/*.test.mjs
npm run lint
npm run build
npx tsc --noEmit
```

No email is sent by these commands.

References:
- https://react.dev/reference/react/useEffect
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie
- https://supabase.com/docs/guides/auth/auth-email-passwordless
