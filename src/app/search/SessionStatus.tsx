"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { serializeSessionRequest } from "@/lib/cards/browser-session-queue";

type SessionState = "loading" | "signed-in" | "signed-out" | "retryable";
export default function SessionStatus() {
  const [status, setStatus] = useState<SessionState>("loading");
  const [checking, setChecking] = useState(false);
  const requestEpoch = useRef(0);
  const checkSession = useCallback(async (signal?: AbortSignal) => {
    const epoch = ++requestEpoch.current;
    try {
      const response = await serializeSessionRequest(() => fetch("/api/auth/session", { cache: "no-store", signal }));
      if (!response.ok && response.status !== 503) throw new Error("Session check unavailable");
      const data: unknown = await response.json();
      if (signal?.aborted || epoch !== requestEpoch.current) return;
      if (!data || typeof data !== "object") throw new Error("Invalid session response");
      const session = data as Record<string, unknown>;
      if (response.status === 503 || session.retryable === true) setStatus("retryable");
      else setStatus(session.signedIn === true ? "signed-in" : "signed-out");
    } catch {
      if (!signal?.aborted && epoch === requestEpoch.current) setStatus("retryable");
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void checkSession(controller.signal);
    return () => {
      controller.abort();
      requestEpoch.current++;
    };
  }, [checkSession]);

  if (status === "loading" || status === "signed-out") return null;
  if (status === "retryable") return <div role="status" className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-[#fff1d6] p-3 text-sm text-[#594621]">
    <span>Session check temporarily unavailable. Your sign-in may still be valid.</span>
    <button type="button" disabled={checking} className="rounded-lg border border-[#ad9466] px-3 py-2 font-semibold disabled:opacity-50"
      onClick={async () => {
        setChecking(true);
        try { await checkSession(); } finally { setChecking(false); }
      }}>{checking ? "Checking…" : "Retry"}</button>
  </div>;
  return <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-[#e4f0e9] p-3 text-sm text-[#28443b]">
    <span>✓ Signed in for future AI access</span>
    <button type="button" className="rounded-lg border border-[#668d84] px-3 py-2 font-semibold"
      onClick={async () => {
        try {
          requestEpoch.current++;
          const response = await serializeSessionRequest(() => fetch("/api/auth/session", { method: "DELETE" }));
          if (response.ok) setStatus("signed-out");
        } catch { /* Keep status until server confirms sign-out. */ }
      }}>Sign out</button>
  </div>;
}
