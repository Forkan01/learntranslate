/**
 * Pure decision boundary for a future opt-in distributed refresh route.
 * Retryable outcomes deliberately leave both existing cookies untouched.
 */
export type RefreshDecision =
  | { kind: "set"; access: string; refresh: string; expires: number }
  | { kind: "retryable" };

export function decideDistributedRefresh(
  outcome: { kind: "success"; pair: { access: string; refresh: string; expires: number } } | { kind: "retryable" },
): RefreshDecision {
  if (outcome.kind !== "success") return { kind: "retryable" };
  const { access, refresh, expires } = outcome.pair;
  if (typeof access !== "string" || !access || access.length > 8192 ||
      typeof refresh !== "string" || !refresh || refresh.length > 8192 ||
      !Number.isSafeInteger(expires) || expires < 60 || expires > 86400)
    return { kind: "retryable" };
  return { kind: "set", access, refresh, expires };
}
