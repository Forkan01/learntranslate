"use client";
import { useEffect, useState } from "react";

type Word = { word: string; meaning: string; note?: string };
type Phrase = { en: string; de: string };
type Card = { id: string; prompt: string; answer: string; note?: string };
type Review = { interval: number; due: number; attempts: number; correct: number };
type Mode = "flashcards" | "quiz";
const KEY = "lt:reviews:v1";

export default function PracticePanel({ words, phrases }: { words: Word[]; phrases: Phrase[] }) {
  const [reviews, setReviews] = useState<Record<string, Review>>({});
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(0);
  const [mode, setMode] = useState<Mode>("flashcards");
  const [category, setCategory] = useState<"words" | "sentences">("words");
  const [quizAnswer, setQuizAnswer] = useState<string | null>(null);
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
      setNow(Date.now());
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => { if (ready) try { localStorage.setItem(KEY, JSON.stringify(reviews)); } catch { /* Storage unavailable. */ } }, [reviews, ready]);

  const cards: Card[] = category === "words"
    ? words.map(w => ({ id: "word:" + w.word, prompt: w.meaning, answer: w.word, note: w.note }))
    : phrases.map(p => ({ id: "phrase:" + p.en, prompt: p.en, answer: p.de }));
  const due = cards.filter(c => !(reviews[c.id] || (category === "words" ? reviews[c.id.slice(5)] : undefined)) || (reviews[c.id] || (category === "words" ? reviews[c.id.slice(5)] : undefined))!.due <= now);
  const current = due.length ? due[index % due.length] : undefined;
  const options = current ? [current.answer, ...cards.filter(c => c.id !== current.id && c.answer !== current.answer).slice(0, 3).map(c => c.answer)].sort((a, b) => {
    const hash = (value: string) => [...value].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) | 0, 0);
    return hash(a + current.prompt) - hash(b + current.prompt);
  }) : [];
  function grade(correct: boolean, timestamp: number) {
    if (!current) return;
    const previous = reviews[current.id] || (category === "words" ? reviews[current.id.slice(5)] : undefined) || { interval: 0, due: 0, attempts: 0, correct: 0 };
    const interval = correct ? Math.min(30, previous.interval ? previous.interval * 2 : 1) : 0;
    const dueAt = timestamp + (correct ? interval * 86400000 : 60000);
    setReviews(old => ({ ...old, [current.id]: { interval, due: dueAt, attempts: previous.attempts + 1, correct: previous.correct + Number(correct) } }));
    setSession(old => ({ attempts: old.attempts + 1, correct: old.correct + Number(correct) }));
    setIndex(0);
    setNow(timestamp);
    setRevealed(false);
    setQuizAnswer(null);
    setFeedback(correct ? "Correct! Scheduled for review." : "Keep practicing — this word will return soon.");
  }
  return <section className="space-y-5 rounded-2xl bg-white p-6 shadow-sm">
    <div><h2 className="text-xl font-semibold">Practice German</h2><p className="mt-2 text-sm text-slate-600">{due.length} due · {cards.length} saved · {session.correct}/{session.attempts} correct this session</p></div>
    <div className="flex flex-wrap gap-2"><button type="button" onClick={() => { setCategory("words"); setIndex(0); setRevealed(false); setQuizAnswer(null); setFeedback(""); }} className={`rounded-lg px-4 py-2 ${category === "words" ? "bg-indigo-600 text-white" : "bg-slate-100"}`}>Words ({words.length})</button><button type="button" onClick={() => { setCategory("sentences"); setIndex(0); setRevealed(false); setQuizAnswer(null); setFeedback(""); }} className={`rounded-lg px-4 py-2 ${category === "sentences" ? "bg-indigo-600 text-white" : "bg-slate-100"}`}>Sentences ({phrases.length})</button></div>
    <div className="flex gap-2"><button type="button" onClick={() => { setMode("flashcards"); setRevealed(false); setQuizAnswer(null); setFeedback(""); }} className={`rounded-lg px-4 py-2 ${mode === "flashcards" ? "bg-indigo-600 text-white" : "bg-slate-100"}`}>Flashcards</button><button type="button" onClick={() => { setMode("quiz"); setRevealed(false); setQuizAnswer(null); setFeedback(""); }} className={`rounded-lg px-4 py-2 ${mode === "quiz" ? "bg-indigo-600 text-white" : "bg-slate-100"}`}>Quiz</button></div>
    {current ? <div className="space-y-4 rounded-xl bg-indigo-50 p-5"><p className="text-sm font-semibold text-indigo-700">{category === "words" ? "What is the German for:" : "Translate into German:"}</p><p className="text-2xl font-semibold">{current.prompt}</p>
      {mode === "flashcards" ? <>{revealed ? <><p className="text-xl font-semibold">{current.answer}</p>{current.note && <p className="text-sm text-slate-600">{current.note}</p>}<div className="flex gap-2"><button type="button" onClick={() => grade(false, Date.now())} className="rounded-lg bg-white px-4 py-3">Again</button><button type="button" onClick={() => grade(true, Date.now())} className="rounded-lg bg-indigo-600 px-4 py-3 text-white">Remembered</button></div></> : <button type="button" onClick={() => setRevealed(true)} className="rounded-lg bg-indigo-600 px-4 py-3 text-white">Reveal answer</button>}</> :
      options.length >= 2 ? <div className="grid gap-2">{options.map(option => <button key={option} type="button" disabled={quizAnswer !== null} onClick={() => setQuizAnswer(option)} className="rounded-lg border border-indigo-200 bg-white p-3 text-left">{option}</button>)}</div> : <p className="text-sm text-slate-600">Save at least two different items in this category to enable multiple-choice questions.</p>}
      {mode === "quiz" && quizAnswer !== null && <div role="status" className="rounded-lg bg-white p-3"><p className="font-semibold">{quizAnswer === current.answer ? "Correct!" : "Not quite."}</p><p>Answer: {current.answer}</p>{current.note && <p className="text-sm text-slate-600">{current.note}</p>}<button type="button" onClick={() => grade(quizAnswer === current.answer, Date.now())} className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-white">Continue</button></div>}
    </div> : <p className="rounded-xl bg-emerald-50 p-5 text-emerald-900">{cards.length ? "All caught up! Your next review will appear when an item is due." : "No saved items in this category yet. Save words or phrases from Translate to begin."}</p>}
    {feedback && <p role="status" className="text-sm text-indigo-700">{feedback}</p>}
    <p className="text-xs text-slate-500">Correct answers return after 1, 2, 4, 8… days (up to 30 days). Missed items return after one minute. Progress is stored only in this browser.</p>
  </section>;
}
