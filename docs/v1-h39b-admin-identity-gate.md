# H.39B — Server-verified administrator access gate

## Scope
This milestone introduces the **authorization foundation only**. It creates:
- `src/lib/admin/admin-access.mjs`: pure, fail-closed authorization decision;
- `src/lib/admin/server-admin-access.ts`: server-only Supabase Auth
  verification of the existing HttpOnly session cookie;
- `GET /api/admin/access`: a no-cache status response;
- `/admin`: a pastel status-only shell, with **no editor or database access**.

**No card CRUD, import, unpublished-card reads, or publication operations are
accessible through this milestone.** A server-verified user must match one
explicitly configured Supabase Auth user UUID. Email addresses, user-provided
headers, `user_metadata`, signup and ordinary signed-in status are not
admin authorization.

## Production state
The feature is **off by default**. Without configuration, the status route
returns HTTP 404, and the page indicates admin tools are disabled.
Nothing in this PR changes the live Supabase database, RLS, environment
variables or Vercel deployments.

## Configure later, after the PR is reviewed
From **Supabase → Authentication → Users**, obtain the UUID of your existing
approved account. Do not use the project's ID, your email address, or a
service-role key.

Set these **server-only** environment variables only in the environment
where you explicitly want to test admin access:

```dotenv
ENABLE_LEARNTRANSLATE_ADMIN=true
LEARNTRANSLATE_ADMIN_USER_ID=<your-verified-Supabase-Auth-user-UUID>
```

Do not prefix either variable with `NEXT_PUBLIC_`. Do not commit a real ID
or secrets to Git. Both values must be correctly configured; invalid or
missing configuration fails closed.

To test with your laptop, add them to your locally ignored `.env.local`
alongside the existing Supabase URL and **publishable key**, restart
`npm run dev`, and open `http://localhost:3000/admin`.

The existing passwordless Supabase sign-in may be used on the search page.
If you have not signed in, `/api/admin/access` returns 401. A verified but
unapproved account gets 403. A valid approved account gets 200 with
`{"authorized":true}`. A disabled/misconfigured gate gets 404. Errors
never include the admin UUID, access tokens, secrets or unpublished cards.

**Note:** In Next.js this route is only an access status check. An
authenticated browser session may require using the existing auth callback.
Do not paste session cookies or access tokens into issue comments, logs or
ChatGPT.

## Security requirements for H.39C admin mutations
Each future server-side operation MUST:
1. Use `resolveAdminAccess(request) === "allowed"` **on that request**,
   not a browser boolean, email or one-time session claim.
2. Require the existing strict `allowSameOriginWrite(request)` CSRF
   protection for mutations; the approved production/preview origin must
   match the request. Local development behavior needs separate review.
3. Validate method, content type, body byte limit, card schema, ownership,
   search-key collision and category references. Reject unauthorized
   requests before parsing inputs or contacting privileged storage.
4. Apply strict size/count limits, rate limits, audit logging and a manual
   review/publish approval step. Never auto-publish AI-generated content.
5. Keep any secret/service-role credential **server-only**, and do not
   change the published-only RLS policies. Confirm database integrity
   with integration tests before enabling writes.
6. Fail closed if Supabase Auth is unreachable or reports a revoked,
   invalid, anonymous or non-allowlisted user.

## Windows laptop verification

```powershell
node --test tests/v1h39b-admin-identity-gate.test.mjs
node --test tests/*.test.mjs
npx tsc --noEmit
npm run lint
npm run build
```

With the gate **off** (its default), after `npm run dev` the following
should return HTTP 404 with `{"authorized":false}`:

```powershell
curl.exe -i http://localhost:3000/api/admin/access
```

This check requires no admin UUID and never mutates production data.
