/**
 * Opt-in orchestration primitive; intentionally NOT wired into the session route.
 * A failed or ambiguous refresh always preserves the browser's existing cookies.
 */
export type VerifiedPair = { access: string; refresh: string; expires: number };
export type RefreshOutcome =
  | { kind: "success"; pair: VerifiedPair }
  | { kind: "retryable" };

export type RefreshDependencies<Lease> = {
  acquire: () => Promise<Lease | null>;
  readVerifiedHandoff: () => Promise<VerifiedPair | null>;
  refreshProvider: () => Promise<VerifiedPair>;
  publish: (lease: Lease, pair: VerifiedPair) => Promise<boolean>;
  release: (lease: Lease) => Promise<boolean>;
  wait: (milliseconds: number) => Promise<void>;
};

/**
 * Only one lease holder calls the provider. Contenders may adopt a handoff
 * after verification; otherwise they receive retryable, never signed-out.
 * A successful provider refresh that cannot be published is NOT returned:
 * other workers may have acquired a newer lease, so the result is ambiguous.
 */
export async function coordinateRefresh<Lease>(
  deps: RefreshDependencies<Lease>,
): Promise<RefreshOutcome> {
  let lease: Lease | null;
  try {
    const existing = await deps.readVerifiedHandoff();
    if (existing) return { kind: "success", pair: existing };
    lease = await deps.acquire();
  } catch {
    return { kind: "retryable" };
  }
  if (lease === null) {
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        await deps.wait(150);
        const handoff = await deps.readVerifiedHandoff();
        if (handoff) return { kind: "success", pair: handoff };
      } catch { return { kind: "retryable" }; }
    }
    return { kind: "retryable" };
  }
  try {
    // A handoff may have appeared between the first read and lease acquisition.
    const existing = await deps.readVerifiedHandoff();
    if (existing) return { kind: "success", pair: existing };
    const pair = await deps.refreshProvider();
    if (!await deps.publish(lease, pair)) return { kind: "retryable" };
    return { kind: "success", pair };
  } catch {
    // Includes invalid-token responses: another instance may have rotated it.
    return { kind: "retryable" };
  } finally {
    try { await deps.release(lease); } catch { /* lease expires on its own */ }
  }
}
