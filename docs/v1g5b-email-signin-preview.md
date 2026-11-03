# V1-G.5B — Optional email sign-in preview

The Search page now offers an **optional** email OTP verification panel only when a card is missing. The panel uses Supabase Auth REST with the **publishable** key, and never sends or stores a private API key. Search and Categories stay public.

**Important limitations:** This is an email verification UI preview, not a persistent login/session implementation. The access token returned by Supabase is checked for presence then deliberately discarded; it is not stored, forwarded to our server, or used to generate cards. Refreshing the page resets the preview. The AI generation button stays disabled.

**Supabase configuration:** Email OTP verification with a numeric code requires configuring the Auth email template to include `{{ .Token }}` rather than only a magic-link URL. Confirm email provider/rate limits and test on a preview deployment before relying on this flow. The Supabase project must be configured with appropriate allowed origins and production email delivery; no configuration is changed by this PR.

**Before enabling public generation:** implement a secure session lifecycle, server-side token verification, derive the quota actor from verified UUID, add anti-abuse and cost controls, and run integration tests. No auth token should be treated as valid merely because it was returned to a browser.

Run GitHub CI and `node --test tests/v1g5b-email-signin-preview.test.mjs`. These are source-contract checks, not email-delivery integration tests.
