/**
 * Pure authorization decision. Never trust an email, a browser-supplied user ID,
 * or user_metadata: the caller MUST provide a server-verified Supabase identity.
 *
 * Environment configuration is passed only from server-only code. No secrets
 * are exported to client bundles.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** @param {unknown} value */
export function normalizeAdminUserId(value) {
  return typeof value === "string" && UUID.test(value) ? value.toLowerCase() : null;
}

/**
 * @param {{
 *   enabled: string | undefined;
 *   adminId: string | undefined;
 *   accessToken: string | undefined;
 *   verifyUser: (token: string) => Promise<{id: string} | null>;
 * }} input
 * @returns {Promise<"disabled" | "unauthenticated" | "forbidden" | "allowed">}
 */
export async function evaluateAdminAccess({ enabled, adminId, accessToken, verifyUser }) {
  const configured = normalizeAdminUserId(adminId);
  // Invalid/missing configuration is indistinguishable from a disabled feature.
  if (enabled !== "true" || !configured) return "disabled";
  if (typeof accessToken !== "string" || accessToken.length === 0) return "unauthenticated";
  try {
    // Verify with Supabase Auth for this request. A signed-in user alone
    // is NEVER enough to become a LearnTranslate administrator.
    const user = await verifyUser(accessToken);
    const verifiedId = normalizeAdminUserId(user?.id);
    if (!verifiedId) return "unauthenticated";
    return verifiedId === configured ? "allowed" : "forbidden";
  } catch {
    // A transient identity-provider failure must NOT grant access.
    return "unauthenticated";
  }
}
