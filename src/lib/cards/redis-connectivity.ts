/**
 * Read-only Upstash connectivity check. Never writes keys or logs credentials.
 * Does not prove the database is isolated; that is a deployment configuration decision.
 */
export async function checkRedisConnectivity(): Promise<boolean> {
  const endpoint = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!endpoint || !token) return false;
  let url: URL;
  try {
    url = new URL(endpoint);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/") return false;
  } catch { return false; }
  try {
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify(["PING"]),
      cache: "no-store",
      signal: AbortSignal.timeout(3500),
    });
    if (!response.ok) return false;
    const payload: unknown = await response.json();
    return !!payload && typeof payload === "object" &&
      !Array.isArray(payload) && (payload as { result?: unknown }).result === "PONG";
  } catch { return false; }
}
