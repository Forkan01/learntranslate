# H.39C.2 — Fix local magic-link callback (no SMTP required)

## Why the original admin sign-in failed

Supabase verified the user's magic-link email, but the LearnTranslate
`/auth/callback` page repeatedly displayed **No sign-in token found**.

The callback previously did this in its React `useEffect`:
1. Extract `access_token` and `refresh_token` from the URL fragment.
2. Immediately scrub the fragment with `window.history.replaceState`.
3. Asynchronously verify identity and send the credential pair to the
   existing HttpOnly session endpoint.

**React StrictMode intentionally executes an extra development-only
effect setup/cleanup/setup cycle.** The first setup captures and removes the
fragment; the first cleanup cancels asynchronous processing. A second setup
then sees an empty fragment and incorrectly reports missing credentials.
This is a strong explanation for the repeatable local `npm run dev` failure.
It is still possible for an email scanner to consume a single-use link;
this fix does not guarantee against external scanners.

## Fix

The browser now captures the URL fragment *once* in a component `useRef`
and reuses the parsed, in-memory credential pair if React replays the effect.
It still immediately removes credentials from the visible URL. The cancelled
effect does not establish a session; the active one verifies the token with
Supabase and posts to the same existing authenticated server endpoint.
The ref is cleared after successful verification or an exception.

No new auth provider, email template, SMTP setup, client-side credential
persistence, privileged route, or database migration is required.

## Important correction to previous OTP instructions

Supabase displayed **Set up custom SMTP to edit templates** in the connected
project's Authentication → Emails → Magic link or OTP screen.
Therefore the previously proposed **six-digit OTP** plan is blocked without
additional email infrastructure. This PR replaces it with the minimal
magic-link callback fix. **Do not configure custom SMTP for this milestone.**
Keep the default Supabase template as-is.

## Local setup and verification

Keep your local `.env.local` settings for the existing admin gate:

```dotenv
ENABLE_LEARNTRANSLATE_ADMIN=true
LEARNTRANSLATE_ADMIN_USER_ID=<existing-Supabase-Auth-user-UUID>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Do not paste keys, one-time link URLs, access/refresh tokens or session
cookies into GitHub, issue comments or chat.

1. Run local tests, lint, TS and production build.
2. Run `npm run dev` on the updated branch.
3. Open `http://localhost:3000/search`, search a missing word and click
   **Sign in (preview)**.
4. Request a fresh magic link for the same existing Supabase account.
5. Open the email link **exactly once**, in the browser with the local app.
6. The callback should display **Signed in successfully!**.
7. In the same browser, open `http://localhost:3000/api/admin/access`.
   The authorized account should return `{"authorized":true}`.
8. Visit `http://localhost:3000/admin`. The card listing will remain
   unavailable until the separate server-only review-read flag and service
   credential are configured. No mutation or publishing is enabled.

If the email provider has an aggressive URL scanner, the link may be
consumed before the browser arrives. That is a separate issue. Do not
disable safe-link protection or print token-bearing URLs as a workaround.

## Windows PowerShell verification

```powershell
node --test tests/v1h39c2-strict-magic-link-callback.test.mjs
node --test tests/*.test.mjs
npx tsc --noEmit
npm run lint
npm run build
```

Existing H.39B/H.39C authorization and database security restrictions
are unchanged.

References:
- https://react.dev/reference/react/useEffect
- https://supabase.com/docs/guides/auth/auth-email-passwordless
