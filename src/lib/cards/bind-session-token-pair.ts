import { verifyGenerationUser } from "@/lib/cards/verified-generation-user";

export type BoundSession = { access: string; refresh: string; expires: number };

/**
 * Prove the refresh credential belongs to the same Supabase user as the
 * verified access credential. Refresh rotates credentials: only persist the
 * returned pair, never the unverified input refresh token.
 */
export async function bindSessionTokenPair(
  access: string, refresh: string, config: { url: string; key: string },
): Promise<BoundSession | null> {
  const original = await verifyGenerationUser(access);
  if (!original) return null;
  try {
    const response = await fetch(config.url + "/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      headers: { apikey: config.key, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    const tokens = data as Record<string, unknown>;
    if (typeof tokens.access_token !== "string" || tokens.access_token.length > 8192 ||
        typeof tokens.refresh_token !== "string" || tokens.refresh_token.length < 8 ||
        tokens.refresh_token.length > 8192 || !/^[A-Za-z0-9._~-]+$/.test(tokens.refresh_token) ||
        typeof tokens.expires_in !== "number" || !Number.isSafeInteger(tokens.expires_in) ||
        tokens.expires_in < 60 || tokens.expires_in > 86400) return null;
    const refreshed = await verifyGenerationUser(tokens.access_token);
    if (!refreshed || refreshed.id !== original.id) return null;
    return { access: tokens.access_token, refresh: tokens.refresh_token, expires: tokens.expires_in };
  } catch { return null; }
}
