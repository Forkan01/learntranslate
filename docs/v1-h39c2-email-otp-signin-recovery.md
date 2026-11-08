# H.39C.2 — Email OTP sign-in recovery (before admin activation)

## Why

The existing magic-link callback handles **implicit-flow URL fragments** only.
Some email providers and link-checking services pre-open single-use login URLs,
and the callback can then receive an empty fragment or an expired-link error.
This gives a misleading "No sign-in token found" result even though Supabase
may already have registered a successful verification attempt.

This PR adds **a separate, direct six-digit email code sign-in** at
`/auth/sign-in`. It does not disable other sign-in implementations or change
admin access/RLS. The old callback now guides users to this new screen.

## Supabase setup — manual dashboard configuration REQUIRED

Supabase email OTP and magic links share the same send API. The email format
determines whether an OTP is visible. A standard magic-link-only template
does **not** contain a user-readable code.

1. Open the connected **LearnTranslate Supabase project** in the dashboard.
2. Navigate **Authentication → Email Templates → Magic Link**.
3. **Save a copy of the current email template** before making changes.
4. Update the HTML email template to send a six-digit code. For example:

```html
<h2>LearnTranslate sign-in code</h2>
<p>Enter this six-digit code in LearnTranslate:</p>
<p style="font-size: 28px"><strong>{{ .Token }}</strong></p>
<p>If you did not request this code, you can ignore this email.</p>
```

5. Save the template. Keep the default Supabase OTP expiry/rate limits
   conservative. Do not make the login code available through logs.
6. This **replaces magic-link sign-in emails** for this Supabase project.
   Users still following the **old legacy search preview's** link flow
   will not find a link; they should instead use `/auth/sign-in`.
   Do not change the template if another system needs magic links without
   first coordinating the impact.

Reference: Supabase [Passwordless email sign-in](https://supabase.com/docs/guides/auth/auth-email-passwordless)
(section **With OTP**). The email template must include the literal
template variable `{{ .Token }}` (including braces and spaces).

## Local configuration / permissions

Keep the existing server-only administrator configuration in the locally
ignored `.env.local` file:

```dotenv
ENABLE_LEARNTRANSLATE_ADMIN=true
LEARNTRANSLATE_ADMIN_USER_ID=<the existing Supabase Auth user UUID>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Also retain the existing Supabase URL and publishable key. These values
do not grant card DB read/write privileges. No service-role key is needed
to verify email login or check `/api/admin/access`.

Run `npm run dev` after updating your local repo.

## Verify the end-to-end flow in your browser

1. Open `http://localhost:3000/auth/sign-in` (do **not** open the old
   `/auth/callback` page manually).
2. Enter the email of the already-registered Supabase user. Do **not**
   create a new account; OTP requests use `create_user: false`.
3. Click **Send six-digit code**. Check email. You should see six digits,
   not just a clickable confirmation URL.
4. Enter the six digits in the app and click **Verify code and sign in**.
   The code is sent to Supabase Auth over HTTPS. The returned pair stays
   in memory just long enough to be posted to the existing same-origin,
   server-verified `/api/auth/session` endpoint.
5. The app will confirm the browser's HttpOnly server session via
   `GET /api/auth/session` before displaying **Your session is confirmed**.
6. Open `http://localhost:3000/api/admin/access` in **the same browser**.
   Expected for the configured account: `{"authorized":true}`.
7. Open `http://localhost:3000/admin`. The dashboard may display
   **Review cards cannot be loaded** until the *separately controlled*
   review database read feature is configured. That is expected.

Do **not** paste or screenshot an email code, magic URL, session cookie,
Supabase publishable/secret key or refresh/access token in chat.

## Expected failure states

- Invalid/expired code → a generic retry notice; request a new OTP.
- A code-only template is not configured → the email contains only a link;
  fix the template rather than clicking the link again.
- `POST /api/auth/session` returns 403 → local
  `NEXT_PUBLIC_APP_URL` likely missing or incorrect. Correct it and
  restart the dev server, then request a fresh code.
- After successful OTP verification the browser GET is not signed in →
  no success claim; check the HTTPS/Secure cookie behavior and ensure
  the browser is using `http://localhost:3000` on the same device.
- User is signed in but `/api/admin/access` responds 403 → the logged-in
  account is not the allowlisted Auth user UUID. Do not grant blanket
  permissions to resolve it.
- `/api/admin/access` responds 401 → no validated browser session.
- Auth 429 → wait for the existing Supabase rate-limit window to reset.

## Windows laptop verification

```powershell
node --test tests/v1h39c2-email-otp-signin.test.mjs
node --test tests/*.test.mjs
npx tsc --noEmit
npm run lint
npm run build
```

No Supabase SQL, Auth users, RLS policies, Vercel secrets or production
environment variables are changed in this PR.
