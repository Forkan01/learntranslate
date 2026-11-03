# V1-G.5B.1 — Default Supabase email-link compatibility

Supabase's default email templates send confirmation/magic links. This patch changes the optional sign-in preview from numeric OTP entry to a link-based flow without requiring custom SMTP.

The Search missing-card panel sends `POST /auth/v1/otp` with `redirect_to: <current origin>/auth/callback`. After clicking the email link, Supabase redirects to the callback with access credentials in the URL fragment. The callback removes the fragment immediately, checks the access token against `GET /auth/v1/user`, and displays success or failure. It does not persist tokens, create a durable session, or unlock AI generation.

**Required manual setup:** In Supabase → Authentication → URL Configuration, set Site URL to the production app and add `https://learntranslate.vercel.app/auth/callback` to allowed Redirect URLs. For Vercel previews, add the exact preview callback URL before testing there. Default confirmation templates remain unchanged. Supabase email rate limits apply. Verify a fresh link on the production deployment and confirm the callback lands on LearnTranslate, not localhost.

**Security/limitations:** This is verification-only; access tokens are deliberately discarded. There is no persistent authentication, no public generation, and no quota connection. Later milestones must implement a secure durable session and verify the user server-side before using their ID as a quota actor. Fragment-based callbacks can be sensitive to browser extensions; do not log URL fragments or credentials.
