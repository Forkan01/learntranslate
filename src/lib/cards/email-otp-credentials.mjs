/**
 * Public browser-side OTP input/session-shape checks.
 * Credentials are short-lived values handled in memory; never persist or log.
 * The authoritative validation is still performed by Supabase Auth and the
 * existing server-side /api/auth/session token-pair binding.
 */
const CREDENTIAL = /^[A-Za-z0-9._~-]+$/;

export function validEmailOtp(value) {
  return typeof value === "string" && /^[0-9]{6}$/.test(value);
}

export function validOtpEmail(value) {
  return typeof value === "string" && value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function parseEmailOtpSession(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const { access_token: access, refresh_token: refresh, expires_in: expires } = value;
  if (typeof access !== "string" || access.length === 0 || access.length > 8192 ||
      !CREDENTIAL.test(access) ||
      typeof refresh !== "string" || refresh.length < 8 || refresh.length > 8192 ||
      !CREDENTIAL.test(refresh) ||
      !Number.isSafeInteger(expires) || expires < 60 || expires > 86400) return null;
  return { access_token: access, refresh_token: refresh, expires_in: expires };
}
