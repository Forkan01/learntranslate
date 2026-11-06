"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { serializeSessionRequest } from "@/lib/cards/browser-session-queue";

/**
 * Supabase's default email link redirects with tokens in the URL fragment.
 * Verify the access token with Auth before displaying success; never persist it.
 * The server creates an HttpOnly session after verifying the token pair.
 */
export default function AuthCallbackPage() {
  const [status, setStatus] = useState("Verifying your email link…");
  useEffect(() => {
    let cancelled = false;
    async function verify() {
      const hash = new URLSearchParams(window.location.hash.slice(1));
      // Remove credentials from the visible URL immediately, including on error.
      window.history.replaceState(null, "", "/auth/callback");
      const token = hash.get("access_token");
      const refresh = hash.get("refresh_token");
      const expires = Number(hash.get("expires_in"));
      const error = hash.get("error_description") || hash.get("error");
      if (error || !token || !refresh || !Number.isFinite(expires)) {
        setStatus(error ? "The email link could not be verified. Please request a new link." :
          "No sign-in token found. Please open a fresh email link.");
        return;
      }
      const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      if (!base || !key) { setStatus("Authentication is not configured."); return; }
      try {
        const url = new URL(base);
        if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new Error("Invalid Auth URL");
        const response = await fetch(url.origin + "/auth/v1/user", {
          headers: { apikey: key, Authorization: "Bearer " + token },
          cache: "no-store",
          signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) throw new Error("Invalid token");
        const user: unknown = await response.json();
        if (!user || typeof user !== "object" || !("id" in user) ||
            typeof (user as { id: unknown }).id !== "string" ||
            (user as { is_anonymous?: boolean }).is_anonymous === true) throw new Error("Invalid user");
        const session = await serializeSessionRequest(() => fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: token, refresh_token: refresh, expires_in: expires }),
          cache: "no-store",
        }));
        if (!session.ok) {
          if (!cancelled) setStatus(session.status === 403
            ? "Sign-in could not finish: this deployment rejected the session request."
            : session.status === 401
              ? "Sign-in could not finish: the session credentials were rejected. Please request a fresh link."
              : "Sign-in could not finish: the session service returned an error. Please try again later.");
          return;
        }
        if (!cancelled) setStatus("✓ Signed in successfully! AI generation is not enabled yet.");
      } catch {
        if (!cancelled) setStatus("Email verification failed or the connection timed out. Please request a fresh link.");
      }
    }
    void verify();
    return () => { cancelled = true; };
  }, []);
  return <main className="mx-auto max-w-lg px-5 py-16">
    <div className="rounded-3xl border border-[#d8d0bb] bg-[#fff9eb] p-8">
      <h1 className="text-2xl font-black text-[#293b37]">✉ LearnTranslate email verification</h1>
      <p role="status" className="mt-4 text-[#4d625d]">{status}</p>
      <Link href="/search" className="mt-6 inline-block rounded-xl bg-[#668d84] px-5 py-3 font-bold text-white">Back to Search</Link>
    </div>
  </main>;
}
