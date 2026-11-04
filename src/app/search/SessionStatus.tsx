"use client";
import { useEffect, useState } from "react";
export default function SessionStatus() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    let active = true;
    fetch("/api/auth/session", { cache: "no-store" })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (active) setSignedIn(data?.signedIn === true); })
      .catch(() => {});
    return () => { active = false; };
  }, []);
  if (!signedIn) return null;
  return <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-[#e4f0e9] p-3 text-sm text-[#28443b]">
    <span>✓ Signed in for future AI access</span>
    <button type="button" className="rounded-lg border border-[#668d84] px-3 py-2 font-semibold"
      onClick={async () => {
        try {
          const response = await fetch("/api/auth/session", { method: "DELETE" });
          if (response.ok) setSignedIn(false);
        } catch { /* Keep status until server confirms sign-out. */ }
      }}>Sign out</button>
  </div>;
}
