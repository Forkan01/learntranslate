import { createHash } from "node:crypto";

/**
 * Coalesce simultaneous refreshes for the same token within one Node process.
 * No raw refresh token is used as a map key or retained after settlement.
 * Does NOT coordinate across serverless instances.
 */
const pending = new Map<string, Promise<unknown>>();

export async function singleFlightRefresh<T>(refreshToken: string, refresh: () => Promise<T>): Promise<T> {
  const key = createHash("sha256").update(refreshToken).digest("hex");
  const existing = pending.get(key);
  if (existing) return existing as Promise<T>;
  const task = Promise.resolve().then(refresh);
  pending.set(key, task);
  try { return await task; }
  finally {
    if (pending.get(key) === task) pending.delete(key);
  }
}
