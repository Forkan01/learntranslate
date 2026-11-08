/**
 * Parse the single-use Supabase magic-link URL fragment once.
 *
 * React StrictMode may run an effect's setup/cleanup/setup sequence in local
 * development. The first setup removes credentials from the browser URL;
 * the second must be able to reuse the already-captured, in-memory values.
 *
 * Callers own the cache (a component useRef). Never persist credentials.
 */
export function captureMagicLinkRedirect(fragment, previous = null) {
  if (previous !== null) return previous;
  if (typeof fragment !== "string" || fragment.length > 20000)
    return { kind: "missing" };
  const parts = new URLSearchParams(fragment.startsWith("#") ? fragment.slice(1) : fragment);
  if (parts.has("error") || parts.has("error_description")) return { kind: "error" };

  const accessToken = parts.get("access_token");
  const refreshToken = parts.get("refresh_token");
  const rawExpiry = parts.get("expires_in");
  if (!accessToken || !refreshToken || !rawExpiry ||
    !/^[1-9][0-9]{0,4}$/.test(rawExpiry)) return { kind: "missing" };

  const expires = Number(rawExpiry);
  if (!Number.isSafeInteger(expires) || expires < 60 || expires > 86400 ||
    accessToken.length > 8192 || refreshToken.length > 8192)
    return { kind: "missing" };
  return { kind: "credentials", accessToken, refreshToken, expires };
}
