"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Supabase's default email link redirects with tokens in the URL fragment.
 * Verify the access token with Auth before displaying success; never persist it.
 * This preview does not create a durable app session.
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
      const error = hash.get("error_description") || hash.get("error");
      if (error || !token) {
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
        if (!cancelled) setStatus("✓ Email verified successfully! AI generation is not enabled yet.");
      } catch {
        if (!cancelled) setStatus("The link is invalid or expired. Please request a new link.");
      }
    }
    void verify();
    return () => { cancelled = true; };
  }, []);
  return <main className="mx-auto max-w-lg px-5 py-16">
    <div className="rounded-3xl border border-[#d8d0bb] bg-[#fff9eb] p-8">
      <h1 className="text-2xl font-black">✉ LearnTranslate email verification</h1>
      <p role="status" className="mt-4 text-[#4d625d]">{status}</p>
      <Link href="/search" className="mt-6 inline-block rounded-xl bg-[#668d84] px-5 py-3 font-bold text-white">Back to Search</Link>
    </div>
  </main>;
}
