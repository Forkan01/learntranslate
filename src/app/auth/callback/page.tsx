"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

export default function AuthCallback() {
  const [message, setMessage] = useState("Completing sign-in…");
  useEffect(() => {
    let active = true;
    async function complete() {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      if (!url || !key) { setMessage("Sign-in is not configured."); return; }
      const client = createClient(url, key, { auth: { flowType: "pkce", detectSessionInUrl: true } });
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const error = params.get("error_description") ?? params.get("error");
      if (error) { setMessage("Sign-in failed. Please request a new link."); return; }
      if (code) {
        const { error: exchangeError } = await client.auth.exchangeCodeForSession(code);
        if (exchangeError) { if (active) setMessage("Sign-in link expired or invalid. Please request a new link."); return; }
        window.location.replace("/");
        return;
      }
      // Some email templates use implicit tokens, which the client can parse.
      const { data } = await client.auth.getSession();
      if (data.session) window.location.replace("/");
      else if (active) setMessage("No valid sign-in session found. Please request a new link.");
    }
    complete().catch(() => { if (active) setMessage("Could not complete sign-in. Please try again."); });
    return () => { active = false; };
  }, []);
  return <main className="mx-auto max-w-md p-8"><h1 className="text-2xl font-bold">LearnTranslate sign-in</h1><p role="status" className="mt-4">{message}</p><Link href="/" className="mt-5 inline-block text-indigo-700 underline">Return to LearnTranslate</Link></main>;
}
