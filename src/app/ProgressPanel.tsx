"use client";
import { useEffect, useState } from "react";

type Review = { interval: number; due: number; attempts: number; correct: number };
type Activity = { date: string; attempts: number; correct: number };
type Word = { word: string; meaning: string };
type Phrase = { en: string; de: string };
const REVIEW_KEY = "lt:reviews:v1";
const ACTIVITY_KEY = "lt:practice-activity:v1";
const dayKey = (timestamp: number) => {
  const d = new Date(timestamp);
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
};

export default function ProgressPanel({ words, phrases }: { words: Word[]; phrases: Phrase[] }) {
  const [reviews, setReviews] = useState<Record<string, Review>>({});
  const [activity, setActivity] = useState<Activity[]>([]);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw: unknown = JSON.parse(localStorage.getItem(REVIEW_KEY) || "{}");
        if (raw && typeof raw === "object" && !Array.isArray(raw)) {
          const safe: Record<string, Review> = {};
          for (const [key, value] of Object.entries(raw)) {
            if (value && typeof value === "object" && "interval" in value && "due" in value && "attempts" in value && "correct" in value && typeof value.interval === "number" && typeof value.due === "number" && typeof value.attempts === "number" && typeof value.correct === "number" && Number.isFinite(value.due) && Number.isFinite(value.interval) && Number.isFinite(value.attempts) && Number.isFinite(value.correct)) safe[key] = value as Review;
          }
          setReviews(safe);
        }
      } catch { /* Storage unavailable. */ }
      try {
        const raw: unknown = JSON.parse(localStorage.getItem(ACTIVITY_KEY) || "[]");
        if (Array.isArray(raw)) setActivity(raw.filter((x): x is Activity => x && typeof x.date === "string" && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(x.date) && Number.isFinite(x.attempts) && Number.isFinite(x.correct)).slice(-365));
      } catch { /* Storage unavailable. */ }
      setNow(Date.now());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const ids = [...words.map(w => ["word:" + w.word, w.word] as const), ...phrases.map(p => ["phrase:" + p.en, ""] as const)];
  const active = ids.map(([id, legacy]) => reviews[id] || (legacy ? reviews[legacy] : undefined)).filter((r): r is Review => Boolean(r));
  const due = active.filter(r => r.due <= now).length + ids.length - active.length;
  const mastered = active.filter(r => r.interval >= 8).length;
  const learning = active.filter(r => r.interval > 0 && r.interval < 8).length;
  const reviewed = active.filter(r => r.interval === 0).length;
  const totalAttempts = active.reduce((n, r) => n + r.attempts, 0);
  const totalCorrect = active.reduce((n, r) => n + r.correct, 0);
  const today = now ? dayKey(now) : "";
  const todayActivity = activity.find(a => a.date === today);
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - (6 - i));
    const key = dayKey(d.getTime());
    return { key, label: d.toLocaleDateString(undefined, { weekday: "short" }), attempts: activity.find(a => a.date === key)?.attempts || 0 };
  });
  let streak = 0;
  if (now) {
    const d = new Date(now);
    d.setHours(12, 0, 0, 0);
    if (!activity.some(a => a.date === dayKey(d.getTime()) && a.attempts > 0)) d.setDate(d.getDate() - 1);
    while (activity.some(a => a.date === dayKey(d.getTime()) && a.attempts > 0)) {
      streak++;
      d.setDate(d.getDate() - 1);
    }
  }
  const next = active.filter(r => r.due > now).map(r => r.due).sort((a,b) => a-b)[0];
  const stats = [
    ["Saved items", ids.length], ["Due now", due], ["Mastered (8+ days)", mastered], ["Learning", learning], ["Needs practice", reviewed], ["Current streak", streak + (streak === 1 ? " day" : " days")]
  ];
  return <section className="space-y-5">
    <div className="rounded-2xl bg-white p-6 shadow-sm"><h2 className="text-xl font-semibold">Your learning progress</h2><p className="mt-2 text-sm text-slate-600">Words and sentences · saved on this browser</p>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">{stats.map(([label, value]) => <div key={label} className="rounded-xl bg-indigo-50 p-4"><p className="text-xs text-indigo-800">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>)}</div>
    </div>
    <div className="rounded-2xl bg-white p-6 shadow-sm"><h2 className="font-semibold">Practice accuracy</h2><p className="mt-3 text-2xl font-bold">{totalAttempts ? Math.round(100 * totalCorrect / totalAttempts) + "%" : "—"}</p><p className="text-sm text-slate-600">{totalCorrect} correct of {totalAttempts} recorded reviews · lifetime totals for currently saved items</p><div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-600" style={{ width: totalAttempts ? Math.round(100 * totalCorrect / totalAttempts) + "%" : "0%" }} /></div><p className="mt-3 text-sm text-slate-600">{next ? "Next scheduled review: " + new Date(next).toLocaleString() : "No future reviews scheduled yet."}</p></div>
    <div className="rounded-2xl bg-white p-6 shadow-sm"><h2 className="font-semibold">Last 7 days</h2><p className="mt-2 text-sm text-slate-600">{todayActivity?.attempts || 0} reviews today · {todayActivity?.correct || 0} correct</p><div className="mt-4 grid grid-cols-7 gap-2">{week.map(d => <div key={d.key} className="text-center"><div title={d.attempts + " reviews"} className="flex h-16 items-end justify-center rounded-lg bg-indigo-50 p-2"><div className="w-full rounded-sm bg-indigo-600" style={{ height: d.attempts ? Math.max(12, Math.min(100, d.attempts * 15)) + "%" : "0%" }} /></div><p className="mt-1 text-xs text-slate-600">{d.label}</p><p className="text-xs font-semibold">{d.attempts}</p></div>)}</div><p className="mt-3 text-xs text-slate-500">Daily activity tracking begins with this update. Earlier reviews count toward lifetime statistics but cannot be assigned to past dates.</p></div>
  </section>;
}
