"use client";
import { useEffect, useState } from "react";

type Word = { word: string; meaning: string; note?: string };
type Review = { interval: number; due: number; attempts: number; correct: number };
type Mode = "flashcards" | "quiz";
const KEY = "lt:reviews:v1";

export default function PracticePanel({ words }: { words: Word[] }) {
  const [reviews, setReviews] = useState<Record<string, Review>>({});
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<Mode>("flashcards");
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [session, setSession] = useState({ attempts: 0, correct: 0 });
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored: unknown = JSON.parse(localStorage.getItem(KEY) || "{}");
        if (stored && typeof stored === "object" && !Array.isArray(stored)) {
          const safe: Record<string, Review> = {};
          for (const [key, value] of Object.entries(stored)) {
            if (value && typeof value === "object" && "due" in value && "interval" in value && "attempts" in value && "correct" in value &&
              typeof value.due === "number" && typeof value.interval === "number" && typeof value.attempts === "number" && typeof value.correct === "number") {
              safe[key] = { due: value.due, interval: value.interval, attempts: value.attempts, correct: value.correct };
            }
          }
          setReviews(safe);
        }
      } catch { /* Storage is optional. */ }
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => { if (ready) try { localStorage.setItem(KEY, JSON.stringify(reviews)); } catch { /* Storage unavailable. */ } }, [reviews, ready]);

  const now = Date.now();
  const due = words.filter(w => !reviews[w.word] || reviews[w.word].due <= now);
  const current = due.length ? due[index % due.length] : undefined;
  const options = current ? [current.word, ...words.filter(w => w.word !== current.word).slice(0, 3).map(w => w.word)].sort((a, b) => {
    const hash = (s: string) => [...s].reduce((n, c) => n * 31 + c.charCodeAt(0), 0);
    return hash(a + current.meaning) - hash(b + current.meaning);
  }) : [];
  function grade(correct: boolean) {
    if (!current) return;
    const previous = reviews[current.word] || { interval: 0, due: 0, attempts: 0, correct: 0 };
    const interval = correct ? Math.min(30, previous.interval ? previous.interval * 2 : 1) : 0;
    const dueAt = Date.now() + (correct ? interval * 86400000 : 60000);
    setReviews(old => ({ ...old, [current.word]: { interval, due: dueAt, attempts: previous.attempts + 1, correct: previous.correct + Number(correct) } }));
    setSession(old => ({ attempts: old.attempts + 1, correct: old.correct + Number(correct) }));
    setIndex(0);
    setRevealed(false);
    setFeedback(correct ? "Correct! Scheduled for review." : "Keep practicing — this word will return soon.");
  }
  if (!words.length) return <section className="rounded-2xl bg-white p-6 shadow-sm"><h2 className="text-xl font-semibold">Practice vocabulary</h2><p className="mt-3 text-slate-600">Save some key words from a translation first. Then return here to practice them.</p></section>;
  return <section className="space-y-5 rounded-2xl bg-white p-6 shadow-sm">
    <div><h2 className="text-xl font-semibold">Vocabulary practice</h2><p className="mt-2 text-sm text-slate-600">{due.length} due · {words.length} saved · {session.correct}/{session.attempts} correct this session</p></div>
    <div className="flex gap-2"><button type="button" onClick={() => { setMode("flashcards"); setRevealed(false); setFeedback(""); }} className={`rounded-lg px-4 py-2 ${mode === "flashcards" ? "bg-indigo-600 text-white" : "bg-slate-100"}`}>Flashcards</button><button type="button" onClick={() => { setMode("quiz"); setRevealed(false); setFeedback(""); }} className={`rounded-lg px-4 py-2 ${mode === "quiz" ? "bg-indigo-600 text-white" : "bg-slate-100"}`}>Quiz</button></div>
    {current ? <div className="space-y-4 rounded-xl bg-indigo-50 p-5"><p className="text-sm font-semibold text-indigo-700">What is the German for:</p><p className="text-2xl font-semibold">{current.meaning}</p>
      {mode === "flashcards" ? <>{revealed ? <><p className="text-xl font-semibold">{current.word}</p>{current.note && <p className="text-sm text-slate-600">{current.note}</p>}<div className="flex gap-2"><button type="button" onClick={() => grade(false)} className="rounded-lg bg-white px-4 py-3">Again</button><button type="button" onClick={() => grade(true)} className="rounded-lg bg-indigo-600 px-4 py-3 text-white">Remembered</button></div></> : <button type="button" onClick={() => setRevealed(true)} className="rounded-lg bg-indigo-600 px-4 py-3 text-white">Reveal answer</button>}</> :
      options.length >= 2 ? <div className="grid gap-2">{options.map(option => <button key={option} type="button" onClick={() => grade(option === current.word)} className="rounded-lg border border-indigo-200 bg-white p-3 text-left">{option}</button>)}</div> : <p className="text-sm text-slate-600">Save at least two different words to enable multiple-choice questions.</p>}
    </div> : <p className="rounded-xl bg-emerald-50 p-5 text-emerald-900">All caught up! Your next review will appear when a word is due.</p>}
    {feedback && <p role="status" className="text-sm text-indigo-700">{feedback}</p>}
    <p className="text-xs text-slate-500">Correct answers return after 1, 2, 4, 8… days (up to 30 days). Missed words return after one minute. Progress is stored only in this browser.</p>
  </section>;
}
