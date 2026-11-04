/**
 * V1-G.6: conservative pre-call spending reservation in integer micro-USD.
 * This is a configured worst-case estimate, NOT measured provider billing.
 * Never enable generation without independently enforcing provider billing limits.
 */
export const COST_RESERVATION_LUA = [
  "local spent = tonumber(redis.call('GET', KEYS[1]) or '0')",
  "local cost = tonumber(ARGV[1])",
  "local cap = tonumber(ARGV[2])",
  "if spent + cost > cap then return 0 end",
  "redis.call('INCRBY', KEYS[1], cost)",
  "redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3]))",
  "return 1",
].join("\n");

function positiveInt(value: string | undefined, maximum: number): number | null {
  if (!value || !/^[1-9][0-9]*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= maximum ? parsed : null;
}

export async function reserveEstimatedGenerationCost(): Promise<"allowed" | "limited" | "unavailable"> {
  const estimated = positiveInt(process.env.CARD_GENERATION_MAX_ESTIMATED_MICRO_USD, 100000000);
  const cap = positiveInt(process.env.CARD_GENERATION_DAILY_CAP_MICRO_USD, 100000000);
  if (!estimated || !cap || estimated > cap) return "unavailable";
  const endpoint = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!endpoint || !token) return "unavailable";
  let url: URL;
  try {
    url = new URL(endpoint);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return "unavailable";
  } catch { return "unavailable"; }
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const ttl = 86400 - (now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds()) + 120;
  const args = ["EVAL", COST_RESERVATION_LUA, "1", "lt:ai:estimated-cost:day:" + day,
    String(estimated), String(cap), String(ttl)];
  try {
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      cache: "no-store",
      signal: AbortSignal.timeout(3500),
    });
    if (!response.ok) return "unavailable";
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || !("result" in payload)) return "unavailable";
    const result = (payload as { result: unknown }).result;
    return result === 1 ? "allowed" : result === 0 ? "limited" : "unavailable";
  } catch { return "unavailable"; }
}
