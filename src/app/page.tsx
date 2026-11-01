"use client";
import { useEffect, useState } from "react";
import PracticePanel from "./PracticePanel";
const tabs = ["Translate", "Learn", "Practice", "Vocabulary", "Progress"] as const;
type Tab = typeof tabs[number];
const phrases = [
  { en: "I am proud of you.", de: "Ich bin stolz auf dich.", grammar: "stolz auf takes the accusative case." },
  { en: "It depends.", de: "Es kommt darauf an.", grammar: "Es kommt darauf an is a common everyday expression." },
  { en: "I am looking forward to meeting you.", de: "Ich freue mich darauf, dich kennenzulernen.", grammar: "sich freuen auf expresses anticipation." }
];
export default function Home() {
  const [tab, setTab] = useState<Tab>("Translate");
  const [input, setInput] = useState("");
  const [reverse, setReverse] = useState(false);
  const [result, setResult] = useState<((typeof phrases)[number] & { examples?: { source: string; target: string }[]; insights?: { words: { word: string; meaning: string; note?: string }[]; alternatives: { text: string; usage: string }[] } }) | null>(null);
  const [saved, setSaved] = useState<{ en: string; de: string }[]>([]);
  const [savedWords, setSavedWords] = useState<{ word: string; meaning: string; note?: string }[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [speechNotice, setSpeechNotice] = useState("");
  useEffect(() => {
    // Defer hydration updates to an asynchronous callback to avoid effect render cascades.
    const timer = window.setTimeout(() => {
      try {
        const phrases: unknown = JSON.parse(localStorage.getItem("lt:saved-phrases:v1") || "[]");
        const words: unknown = JSON.parse(localStorage.getItem("lt:saved-words:v1") || "[]");
        if (Array.isArray(phrases)) setSaved(phrases.filter((x: unknown): x is {en: string; de: string} => typeof x === "object" && x !== null && "en" in x && "de" in x && typeof x.en === "string" && typeof x.de === "string").slice(0, 500));
        if (Array.isArray(words)) setSavedWords(words.filter((x: unknown): x is {word: string; meaning: string; note?: string} => typeof x === "object" && x !== null && "word" in x && "meaning" in x && typeof x.word === "string" && typeof x.meaning === "string").slice(0, 500));
      } catch { /* Malformed or blocked browser storage: use in-memory data. */ }
      setStorageReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => { if (storageReady) try { localStorage.setItem("lt:saved-phrases:v1", JSON.stringify(saved)); } catch { /* Storage unavailable. */ } }, [saved, storageReady]);
  useEffect(() => { if (storageReady) try { localStorage.setItem("lt:saved-words:v1", JSON.stringify(savedWords)); } catch { /* Storage unavailable. */ } }, [savedWords, storageReady]);
  function pronounce(text: string, language: "de" | "en" = "de") {
    setSpeechNotice("");
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) { setSpeechNotice("Pronunciation is not supported in this browser."); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === "de" ? "de-DE" : "en-US";
    utterance.rate = 0.85;
    utterance.onerror = () => setSpeechNotice("Audio unavailable. Check your device's text-to-speech language settings.");
    window.speechSynthesis.speak(utterance);
  }
  function saveWord(word: { word: string; meaning: string; note?: string }) {
    setSavedWords(old => old.some(item => item.word.toLocaleLowerCase("de") === word.word.toLocaleLowerCase("de")) ? old : [...old, word].slice(-500));
  }
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  async function translate() {
    setNotice("");
    setResult(null);
    setSelectedWord(null);
    setLoading(true);
    try {
      const response = await fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: input, source: reverse ? "de" : "en", target: reverse ? "en" : "de" }) });
      if (!response.ok) { setNotice(response.status === 503 ? "Translation is unavailable. Configure Gemini to translate new phrases, or try the offline examples." : "Translation unavailable. Please try again."); return; }
      const data: { sourceText: string; translatedText: string; grammar: string; examples: { source: string; target: string }[]; insights?: { words: { word: string; meaning: string; note?: string }[]; alternatives: { text: string; usage: string }[] } } = await response.json();
      setResult({ en: reverse ? data.translatedText : data.sourceText, de: reverse ? data.sourceText : data.translatedText, grammar: data.grammar, examples: data.examples, insights: data.insights });
    } catch { setNotice("Unable to reach the translation service. Please try again."); } finally { setLoading(false); }
  }
  return <div className="min-h-screen bg-slate-50 pb-24 text-slate-900 md:pb-0">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5"><strong className="text-xl text-indigo-700">✦ LearnTranslate</strong><span className="rounded-full bg-indigo-50 px-3 py-2 text-xs text-indigo-700">German ↔ English</span></div></header>
    <div className="mx-auto grid max-w-6xl gap-8 px-5 py-8 md:grid-cols-[200px_minmax(0,1fr)]">
      <nav aria-label="Learning modules" className="fixed inset-x-0 bottom-0 z-20 flex justify-around gap-1 border-t border-slate-200 bg-white p-2 shadow-lg md:static md:flex-col md:justify-start md:border-0 md:bg-transparent md:p-0 md:shadow-none">
        {tabs.map(t => <button key={t} onClick={() => setTab(t)} aria-current={tab === t ? "page" : undefined} className={`min-w-0 flex-1 rounded-xl px-1 py-3 text-center text-[11px] font-medium md:flex-none md:px-4 md:text-left md:text-sm ${tab === t ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-indigo-50"}`}>{t}</button>)}
      </nav>
      <main className="min-w-0"><p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Learn languages naturally</p><h1 className="mt-2 text-3xl font-bold">{tab === "Translate" ? "More than a translation." : tab}</h1><p className="mt-3 mb-7 text-slate-500">Understand, remember and practice real expressions.</p>
        {tab === "Translate" ? <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <label htmlFor="direction" className="mb-3 block text-sm font-semibold">Language direction</label><select id="direction" value={reverse ? "de" : "en"} onChange={e => { setReverse(e.target.value === "de"); setResult(null); }} className="mb-4 rounded-lg border border-slate-200 p-3"><option value="en">English → German</option><option value="de">German → English</option></select>
            <label htmlFor="input" className="sr-only">Text to translate</label><textarea id="input" value={input} onChange={e => setInput(e.target.value)} placeholder="Type a phrase…" className="min-h-36 w-full rounded-xl border border-slate-200 p-4 focus:border-indigo-500 focus:outline-none" />
            <div className="mt-4 flex justify-end"><button disabled={!input.trim() || loading} onClick={translate} className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white disabled:opacity-40">{loading ? "Translating…" : "Translate →"}</button></div>
          </section>
          {notice && <p role="status" className="rounded-xl bg-amber-50 p-4 text-amber-900">{notice}</p>}
          {result && <section aria-live="polite" className="space-y-4 rounded-2xl bg-white p-6 shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Translation</p><div className="flex items-start gap-3"><p className="min-w-0 flex-1 text-2xl font-semibold">{reverse ? result.en : result.de}</p><button type="button" onClick={() => pronounce(reverse ? result.en : result.de, reverse ? "en" : "de")} aria-label="Listen to translation" className="shrink-0 rounded-lg border border-indigo-200 px-3 py-2 text-indigo-700">🔊 Listen</button></div>{speechNotice && <p role="status" className="text-sm text-amber-700">{speechNotice}</p>}{result.insights && result.insights.words.length > 0 && <details open className="group"><summary className="cursor-pointer font-semibold">Key words · tap to explore</summary><ul className="mt-2 grid gap-2 sm:grid-cols-2">{result.insights.words.map((item, index) => <li key={index} className="rounded-lg bg-indigo-50 p-3"><button type="button" aria-expanded={selectedWord === item.word} onClick={() => setSelectedWord(selectedWord === item.word ? null : item.word)} className="w-full text-left font-semibold text-indigo-900">{item.word} ⌄</button>{selectedWord === item.word && <div className="mt-2 space-y-2"><p className="text-sm text-slate-700">{item.meaning}</p>{item.note && <p className="text-xs text-slate-500">{item.note}</p>}<div className="flex flex-wrap gap-2"><button type="button" onClick={() => pronounce(item.word, reverse ? "en" : "de")} className="rounded-md border border-indigo-200 px-3 py-1 text-xs">🔊 Listen</button><button type="button" onClick={() => saveWord(item)} className="rounded-md border border-indigo-200 px-3 py-1 text-xs">{savedWords.some(w => w.word === item.word) ? "✓ Saved" : "＋ Save word"}</button></div></div>}</li>)}</ul></details>}{result.insights && result.insights.alternatives.length > 0 && <details className="group"><summary className="cursor-pointer font-semibold">Natural alternatives</summary><ul className="mt-2 space-y-2">{result.insights.alternatives.map((item, index) => <li key={index} className="rounded-lg bg-slate-50 p-3"><p>{item.text}</p><p className="text-sm text-slate-500">{item.usage}</p></li>)}</ul></details>}<details className="group"><summary className="cursor-pointer font-semibold">Grammar insight</summary><p className="mt-2 text-slate-600">{result.grammar}</p></details>{result.examples && result.examples.length > 0 && <div><h2 className="font-semibold">Examples</h2><ul className="mt-2 space-y-2">{result.examples.map((example, index) => <li key={index} className="rounded-lg bg-slate-50 p-3"><p>{example.source}</p><p className="text-slate-500">{example.target}</p></li>)}</ul></div>}<button onClick={() => setSaved(old => old.some(item => item.en === result.en) ? old : [...old, { en: result.en, de: result.de }])} className="rounded-lg border border-indigo-300 px-4 py-2 text-indigo-700">{saved.some(item => item.en === result.en) ? "✓ Saved" : "＋ Save phrase"}</button></section>}
          <div><h2 className="mb-3 font-semibold">Try a phrase</h2><div className="flex flex-wrap gap-2">{phrases.map(p => <button key={p.en} onClick={() => { setReverse(false); setInput(p.en); setResult(null); setNotice(""); }} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm">{p.en}</button>)}</div></div>
        </div> : tab === "Vocabulary" ? <section className="rounded-2xl bg-white p-6 shadow-sm"><h2 className="font-semibold">Saved words ({savedWords.length})</h2><div className="mt-3 space-y-2">{savedWords.length ? savedWords.map((item, index) => <div key={index} className="flex items-center justify-between gap-2 rounded-lg bg-indigo-50 p-3"><div><strong>{item.word}</strong><p className="text-sm text-slate-600">{item.meaning}</p>{item.note && <p className="text-xs text-slate-500">{item.note}</p>}</div><button type="button" onClick={() => setSavedWords(old => old.filter(w => w.word !== item.word))} aria-label={`Remove ${item.word}`} className="rounded-md border border-indigo-200 px-3 py-1 text-xs">Remove</button></div>) : <p className="text-slate-500">Tap a key word in a translation to save it here.</p>}</div><h2 className="mt-6 font-semibold">Saved phrases ({saved.length})</h2><div className="mt-4 space-y-3">{saved.length ? saved.map(item => <p key={item.en}>{item.en} — {item.de}</p>) : <p className="text-slate-500">Save translations to see them here. Saved on this device.</p>}</div></section> : tab === "Practice" ? <PracticePanel words={savedWords} /> : <section className="rounded-2xl bg-white p-8 shadow-sm"><h2 className="text-xl font-semibold">{tab} is coming next</h2><p className="mt-3 text-slate-500">This module is planned for an upcoming milestone.</p></section>}
      </main>
    </div>
  </div>;
}
