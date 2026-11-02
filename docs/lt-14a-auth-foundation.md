# LT-14A — Guest-first Supabase authentication foundation

## Project
Supabase project: LearnTranslate (EU Ireland). Production URL: https://learntranslate.vercel.app

## Principles
- Keep Translate, Learn, Practice, Vocabulary and Progress available to guests.
- Never migrate or delete browser-local data automatically at sign-in.
- Use Supabase Auth with the supported Next.js SSR client and cookie-based PKCE exchange.
- Only expose project URL and publishable key to browser. No secret/service-role key in client code.
- Do not merge an auth UI until Google/email flows, redirect allowlist, session refresh and sign-out pass CI and browser tests.
- No private user data tables in LT-14A. LT-14B will create explicit RLS policies before data synchronization.
- Google OAuth is unavailable until Google Cloud OAuth credentials are configured in Supabase.

## Required dashboard configuration
1. Supabase Authentication → URL Configuration: Site URL https://learntranslate.vercel.app
2. Add exact production redirect URL https://learntranslate.vercel.app/auth/callback and localhost callback for development. Add preview URLs only after assessing redirect origin validation.
3. Supabase Authentication → Providers: enable Email. Configure Google separately using Google Cloud OAuth client ID and secret in Supabase dashboard (never commit).
4. Vercel → LearnTranslate → Environment Variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. The key is publishable; do not use service-role or secret keys.
5. Redeploy after environment variables are configured.

## Implementation sequence
A. Install pinned @supabase/supabase-js and @supabase/ssr and commit regenerated package-lock.json.
B. Create browser/server clients, cookie-safe session refresh, and an OAuth PKCE callback.
C. Add account UI with email magic link and Google sign-in; guest access remains the default.
D. Test redirect safety, account switching, sign-out, expired sessions, mobile UI, and local learning data preservation.
E. Follow with LT-14B cloud data tables and guest-to-account import using explicit consent and per-user RLS.

## Acceptance
- Guest can use every existing feature without account.
- Email login and logout work with configured Supabase project.
- Google login only shown as available after provider setup.
- Session persists after refresh, but local guest data is not silently uploaded.
- No secret keys or personal data in source control.
