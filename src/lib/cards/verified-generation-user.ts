/**
 * Server-only identity verification foundation for future public AI quotas.
 * A caller-provided user ID/header is NEVER an identity. Verify the actual
 * Supabase access token against the project's Auth service on each request.
 */
export type VerifiedGenerationUser = { id: string };

export async function verifyGenerationUser(accessToken: string): Promise<VerifiedGenerationUser | null> {
  if (!accessToken || accessToken.length > 8192 || !/^[A-Za-z0-9._~-]+$/.test(accessToken)) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) return null;
  let endpoint: URL;
  try {
    const origin = new URL(base);
    if (origin.protocol !== "https:" || origin.username || origin.password ||
        origin.search || origin.hash) return null;
    endpoint = new URL("/auth/v1/user", origin);
  } catch { return null; }
  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: { apikey: key, Authorization: "Bearer " + accessToken },
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    const user = data as Record<string, unknown>;
    // Reject anonymous accounts and malformed identity responses.
    if (user.is_anonymous === true || typeof user.id !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(user.id)) return null;
    return { id: user.id.toLowerCase() };
  } catch { return null; }
}
