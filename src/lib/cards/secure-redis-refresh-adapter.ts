import { coordinateRefresh, type RefreshOutcome, type VerifiedPair } from "./distributed-refresh-coordinator";
import { decryptRefreshHandoff, encryptRefreshHandoff, refreshIdentity, type HandoffEnvelope } from "./refresh-handoff-crypto";
import { acquireRefreshLease, publishRefreshHandoff, readRefreshHandoff, releaseRefreshLease } from "./refresh-redis-client";

export type RefreshAdapterInputs = {
  refreshToken: string;
  /** Must verify the new access token with the trusted auth provider AND bind its user to the expected session. */
  verifyPair: (pair: VerifiedPair) => Promise<boolean>;
  /** Provider refresh must not be invoked by contenders. */
  refreshProvider: () => Promise<VerifiedPair>;
};

export async function coordinateSecureRedisRefresh(inputs: RefreshAdapterInputs): Promise<RefreshOutcome> {
  const id = refreshIdentity(inputs.refreshToken);
  if (!id) return { kind: "retryable" };
  const readVerifiedHandoff = async (): Promise<VerifiedPair | null> => {
    const raw = await readRefreshHandoff(id);
    if (!raw) return null;
    if (raw.length > 32768) throw new Error("Invalid handoff size");
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { throw new Error("Invalid handoff"); }
    const pair = decryptRefreshHandoff(id, parsed as HandoffEnvelope);
    if (!pair || !await inputs.verifyPair(pair)) throw new Error("Unverified handoff");
    return pair;
  };
  return coordinateRefresh({
    acquire: () => acquireRefreshLease(id),
    readVerifiedHandoff,
    refreshProvider: async () => {
      const pair = await inputs.refreshProvider();
      if (!await inputs.verifyPair(pair)) throw new Error("Unverified provider pair");
      return pair;
    },
    publish: async (lease, pair) => {
      const envelope = encryptRefreshHandoff(id, pair);
      if (!envelope) throw new Error("Handoff encryption unavailable");
      return publishRefreshHandoff(lease, JSON.stringify(envelope));
    },
    release: releaseRefreshLease,
    wait: (milliseconds) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)),
  });
}
