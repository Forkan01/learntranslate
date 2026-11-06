/** UI interpretation only; never grants access to protected server resources. */
export type SessionView = "signed-in" | "signed-out" | "retryable";
export function interpretSessionResponse(status: number, body: unknown): SessionView {
  if (status === 503) return "retryable";
  if (status !== 200 || !body || typeof body !== "object" || Array.isArray(body)) return "retryable";
  const data = body as Record<string, unknown>;
  if (data.retryable === true) return "retryable";
  if (data.signedIn === true) return "signed-in";
  if (data.signedIn === false) return "signed-out";
  return "retryable";
}
