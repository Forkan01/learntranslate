import { randomBytes } from "node:crypto";
import { REFRESH_HANDOFF_TTL_MS, REFRESH_LEASE_TTL_MS, REFRESH_PUBLISH_LUA, REFRESH_RELEASE_LUA, refreshRedisKeys } from "./refresh-redis-protocol";

export type Lease = { id: string; owner: string };
type RedisResult = { result?: unknown; error?: unknown };
async function command(args: (string | number)[]): Promise<unknown> {
  const endpoint = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!endpoint || !token) throw new Error("Redis unavailable");
  const url = new URL(endpoint);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash ||
      url.pathname !== "/") throw new Error("Invalid Redis configuration");
  const response = await fetch(url.toString(), {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    cache: "no-store",
    signal: AbortSignal.timeout(3500),
  });
  if (!response.ok) throw new Error("Redis unavailable");
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Invalid Redis response");
  const parsed = payload as RedisResult;
  if (parsed.error !== undefined || !Object.hasOwn(parsed, "result")) throw new Error("Redis command failed");
  return parsed.result;
}
/** Returns null on contention; throws on backend failures. */
export async function acquireRefreshLease(id: string): Promise<Lease | null> {
  const keys = refreshRedisKeys(id);
  if (!keys) throw new Error("Invalid identity");
  const owner = randomBytes(24).toString("hex");
  const result = await command(["SET", keys.lease, owner, "NX", "PX", REFRESH_LEASE_TTL_MS]);
  if (result === "OK") return { id, owner };
  if (result === null) return null;
  throw new Error("Unexpected lease response");
}
/** Publish ciphertext only when the caller still owns the lease. */
export async function publishRefreshHandoff(lease: Lease, ciphertext: string): Promise<boolean> {
  const keys = refreshRedisKeys(lease.id);
  if (!keys || !/^[a-f0-9]{48}$/.test(lease.owner) || !ciphertext || ciphertext.length > 32768)
    throw new Error("Invalid handoff");
  const result = await command(["EVAL", REFRESH_PUBLISH_LUA, 2, keys.lease, keys.handoff,
    lease.owner, ciphertext, REFRESH_HANDOFF_TTL_MS]);
  if (result === 1) return true;
  if (result === 0) return false;
  throw new Error("Unexpected publish response");
}
export async function releaseRefreshLease(lease: Lease): Promise<boolean> {
  const keys = refreshRedisKeys(lease.id);
  if (!keys || !/^[a-f0-9]{48}$/.test(lease.owner)) throw new Error("Invalid lease");
  const result = await command(["EVAL", REFRESH_RELEASE_LUA, 1, keys.lease, lease.owner]);
  if (result === 1) return true;
  if (result === 0) return false;
  throw new Error("Unexpected release response");
}
/** Returns an encrypted envelope string, never a plaintext token pair. */
export async function readRefreshHandoff(id: string): Promise<string | null> {
  const keys = refreshRedisKeys(id);
  if (!keys) throw new Error("Invalid identity");
  const result = await command(["GET", keys.handoff]);
  if (result === null) return null;
  if (typeof result !== "string" || result.length > 32768) throw new Error("Invalid handoff response");
  return result;
}
