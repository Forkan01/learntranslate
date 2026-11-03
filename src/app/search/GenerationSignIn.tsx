"use client";

import { useState, type FormEvent } from "react";

type AuthState = "idle" | "sending" | "code" | "verifying" | "signed-in";

function authConfig(): { url: string; key: string } | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) return null;
  try {
    const url = new URL(base);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
    return { url: url.origin, key };
  } catch { return null; }
}

/**
 * Lightweight passwordless sign-in for future AI access.
 * Access tokens are held in component memory only, never persisted or logged.
 * This UI does NOT unlock AI generation.
 */
export default function GenerationSignIn() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [state, setState] = useState<AuthState>("idle");
  const [message, setMessage] = useState("");
  const [verifiedEmail, setVerifiedEmail] = useState("");
  async function sendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "sending" || state === "verifying") return;
    const config = authConfig();
    if (!config) { setMessage("Sign-in is not configured yet."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      setMessage("Enter a valid email address."); return;
    }
    setState("sending"); setMessage("");
    try {
      const response = await fetch(config.url + "/auth/v1/otp", {
        method: "POST", headers: { apikey: config.key, "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), create_user: true }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Email request failed");
      setState("code");
      setMessage("Check your email for a six-digit sign-in code.");
    } catch { setState("idle"); setMessage("Couldn't send a code. Please try again later."); }
  }
  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state !== "code" || !/^\d{6,8}$/.test(code.trim())) {
      setMessage("Enter the code from your email."); return;
    }
    const config = authConfig();
    if (!config) { setMessage("Sign-in is not configured yet."); return; }
    setState("verifying"); setMessage("");
    try {
      const response = await fetch(config.url + "/auth/v1/verify", {
        method: "POST", headers: { apikey: config.key, "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), token: code.trim(), type: "email" }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Verification failed");
      const payload: unknown = await response.json();
      if (!payload || typeof payload !== "object" || !("access_token" in payload) ||
          typeof (payload as { access_token: unknown }).access_token !== "string") {
        throw new Error("Missing session");
      }
      // This V1 foundation deliberately does not persist or forward tokens.
      setVerifiedEmail(email.trim()); setCode(""); setState("signed-in");
      setMessage("Email verified. AI generation is not available yet.");
    } catch { setState("code"); setMessage("Code expired or invalid. Please try again."); }
  }
  return <div className="mt-4 rounded-2xl border border-[#ddcfb5] bg-white p-4">
    <h3 className="font-black">✉ Sign in for future AI access</h3>
    <p className="mt-1 text-sm text-[#645e55]">Searching and browsing vocabulary remain free without an account.</p>
    {state === "signed-in" ? <p className="mt-3 text-sm font-semibold">✓ Verified: {verifiedEmail}</p> :
      state === "code" || state === "verifying" ?
      <form onSubmit={verifyCode} className="mt-3 flex flex-wrap gap-2">
        <label className="w-full text-sm font-semibold" htmlFor="lt-signin-code">Email verification code</label>
        <input id="lt-signin-code" value={code} onChange={e=>setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={8} className="min-w-0 flex-1 rounded-xl border p-3" placeholder="6-digit code" required />
        <button type="submit" disabled={state === "verifying"} className="rounded-xl bg-[#668d84] px-4 py-3 font-bold text-white disabled:opacity-50">Verify</button>
      </form> :
      <form onSubmit={sendCode} className="mt-3 flex flex-wrap gap-2">
        <label className="w-full text-sm font-semibold" htmlFor="lt-signin-email">Email address</label>
        <input id="lt-signin-email" type="email" value={email} onChange={e=>setEmail(e.target.value)} maxLength={254} autoComplete="email" className="min-w-0 flex-1 rounded-xl border p-3" placeholder="you@example.com" required />
        <button type="submit" disabled={state === "sending"} className="rounded-xl bg-[#668d84] px-4 py-3 font-bold text-white disabled:opacity-50">Send code</button>
      </form>}
    {message && <p role="status" className="mt-3 text-sm text-[#6c6050]">{message}</p>}
    <p className="mt-3 text-xs text-[#77756e]">Email verification is a preview. It does not enable generation or keep you signed in after refresh.</p>
  </div>;
}
