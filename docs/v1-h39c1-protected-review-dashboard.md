# H.39C.1 — Protected read-only review dashboard

## What this milestone provides

This milestone adds the first real admin card-management view:
- `/admin`: a mobile-friendly, pastel card dashboard gated behind H.39B.
- `GET /api/admin/cards`: a paginated, read-only endpoint for the verified
  server-configured administrator.
- Filters by status (**review, draft, published, rejected, all**) and card type
  (**word, sentence, all**); paginates 20 at a time.
- Card detail preview: translation, noun metadata, curated examples and
  sentence grammar when present.

**Important:** This milestone does NOT create, update, publish, reject, import,
or delete cards. It does not expose a mutation endpoint. That is the next
phase, once review and admin authentication are verified in a real browser.

## Server-side security controls

- Each `/api/admin/cards` request calls the existing
  `resolveAdminAccess(request)` first. Authorization does not depend on
  client-side navigation, a cookie-supplied role, or an email address.
- With `ENABLE_LEARNTRANSLATE_ADMIN` unset, both dashboard access and review
  listing are disabled.
- Review-list access additionally requires
  `ENABLE_LEARNTRANSLATE_ADMIN_REVIEW_READ=true`, plus a server-only
  `SUPABASE_SERVICE_ROLE_KEY`. If anything is missing, listing fails closed.
- Service-role credentials are sent to Supabase only by server-side code,
  never to the browser, and the server response omits the key.
- The database URL must be HTTPS without a path, query, fragment or credentials.
- Incoming filter query parameters are allowlisted and bounded. Unrecognized,
  repeated, overlong or malformed values are rejected.
- The server requests 21 rows max and exposes only 20 (one lookahead for
  pagination). The response is validated before returning and never cached.
- A database failure returns a generic status, not credentials or detailed
  backend output.
- No Supabase schema, RLS policy, user roles or live data changed in this PR.

## Local setup after the PR passes tests

The first test is deliberately run **with admin flags OFF**:

```powershell
npm run dev
curl.exe -i http://localhost:3000/api/admin/access
curl.exe -i http://localhost:3000/api/admin/cards
```

Both should return HTTP 404. The `/admin` page should indicate admin
access is disabled. This verifies that neither public users nor ordinary
signed-in users can read unpublished cards by default.

Only after confirming the merged branch and deciding to activate the local
admin preview, obtain the account's **Auth user UUID** from Supabase Dashboard →
Authentication → Users. This ID must refer to the account that will sign in
to LearnTranslate. It is **not** the project ID, email or publishable API key.

To enable **locally only**, add the following **server-only** configuration
to the ignored `.env.local` file:

```dotenv
ENABLE_LEARNTRANSLATE_ADMIN=true
LEARNTRANSLATE_ADMIN_USER_ID=<UUID-from-Authentication-Users>
ENABLE_LEARNTRANSLATE_ADMIN_REVIEW_READ=true
SUPABASE_SERVICE_ROLE_KEY=<server-only-legacy-service-role-JWT>
```

**Never paste the service-role key in chat, logs or GitHub, and never use a
`NEXT_PUBLIC_` prefix for it.** It bypasses RLS. Keep it in your local
machine's ignored `.env.local` or a private deployment secret store only.
Do not configure it on production until the access gate has been tested and
reviewed independently. The latest Supabase secret-key setup may have
different auth header requirements; this code requires the legacy
`service_role` JWT specifically.

You may also set `NEXT_PUBLIC_APP_URL=http://localhost:3000` **only in
your local `.env.local`** if you are deliberately testing the existing
same-origin sign-in callback locally. Never deploy the localhost URL to
production; restart `npm run dev` after changes. Use the browser and your
existing passwordless Supabase login to obtain a session. Note that the
Supabase project's redirect URL allowlist must include the local callback
origin, and there may be separate Supabase auth rate limits.

Expected authorized flow:
1. Open `http://localhost:3000/admin` as an anonymous user → **Sign in
   required**; no cards loaded.
2. Sign in to LearnTranslate with the account UUID configured above,
   then return to `/admin`.
3. Filter by status: **Review** will be empty unless review rows exist;
   choose **Published** or **All statuses** to view the existing cards.
4. Select a card to see its read-only grammar/translation/examples.

Expected non-admin flow: A different signed-in account gets HTTP 403 and
cannot list cards. If the Supabase Auth service is down or the user has an
expired token, access fails closed.

Do not use `curl` alone to assert successful admin login; the existing
session uses Secure HttpOnly cookies. Test login through the browser.

## Windows laptop tests (no GitHub-hosted CI quota)

```powershell
node --test tests/v1h39c1-protected-review-dashboard.test.mjs
node --test tests/*.test.mjs
npx tsc --noEmit
npm run lint
npm run build
```

## Next steps

**H.39C.2 — Drafting and editing with explicit review saves:** Make a
protected form for manual Word/Sentence Cards and create a separate,
independently authorized, bounded write route. Require origin/CSRF checks,
schema validation, search-key uniqueness, quotas/rate limits, and audit logs.

**H.39C.3 — Review and publishing:** Provide explicit approve/reject/publish
actions with confirmed human review, optimistic concurrency checks,
rollback/backup plan, and audited database transitions. No AI generation may
publish directly without review.

**H.39C.4 — Bulk import interface:** Integrate the validated JSON import
format and safety checks with a protected preview, duplicate report and
review-only submit. Never implicitly overwrite published cards.
