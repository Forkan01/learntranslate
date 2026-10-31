"use client";

import { useState } from "react";

type Entry = { english: string; german: string; note: string; examples: string[] };
const entries: Entry[] = [
  { english: "I'm looking forward to meeting you.", german: "Ich freue mich darauf, dich kennenzulernen.", note: "sich freuen auf + Akkusativ expresses anticipation. The infinitive uses zu.", examples: ["Ich freue mich auf morgen. — I'm looking forward to tomorrow.", "Schön, dich kennenzulernen. — Nice to meet you."] },
  { english: "It depends.", german: "Es kommt darauf an.", note: "Es kommt darauf an is a common everyday expression. Add auf + Akkusativ to specify what it depends on.", examples: ["Es kommt auf das Wetter an. — It depends on the weather.", "Das kommt darauf an. — That depends."] },
  { english: "I am proud of you.", german: "Ich bin stolz auf dich.", note: "stolz auf + Akkusativ means proud of someone or something.", examples: ["Sie ist stolz auf ihren Sohn. — She is proud of her son.", "Du kannst stolz auf dich sein. — You can be proud of yourself."] },
  { english: "I will be five minutes late.", german: "Ich komme fünf Minuten später.", note: "Später means later. For being late to work, you can also say Ich verspäte mich um fünf Minuten.", examples: ["Entschuldigung, ich komme etwas später. — Sorry, I'll arrive a little later.", "Ich verspäte mich um fünf Minuten. — I'll be five minutes late."] },
];
const sections = ["Translate", "Learn", "Practice", "Vocabulary", "Progress"] as const;
type Section = (typeof sections)[number];

export default function Home() {
  const [section, setSection] = useState<Section>("Translate");
  const [text, setText] = useState("");
  const [direction, setDirection] = useState<"en-de" | "de-en">("en-de");
  const [result, setResult] = useState<Entry | null>(null);
  const [saved, setSaved] = useState<Entry[]>([]);
  const [message, setMessage] = useState("");
  const translate = () => {
    const query = text.trim().toLocaleLowerCase();
    const match = entries.find((entry) => (direction === "en-de" ? entry.english : entry.german).toLocaleLowerCase() === query);
    setResult(match ?? null);
    setMessage(match ? "" : "This offline demo currently supports the sample phrases below. AI translation is coming in a later milestone.");
  };
  return (
    <div className="min-h-screen bg-[#f7f8fc] text-slate-900">
      <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5"><div className="text-xl font-bold tracking-tight text-indigo-700">✦ LearnTranslate</div><span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">German ↔ English · Demo</span></div></header>
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-8 md:grid-cols-[210px_1fr]">
        <nav aria-label="Main navigation" className="flex gap-2 overflow-x-auto md:flex-col">{sections.map((item) => <button key={item} onClick={() => setSection(item)} className={`whitespace-nowrap rounded-xl px-4 py-3 text-left text-sm font-medium ${section === item ? "bg-indigo-600 text-white" : "bg-white text-slate-600 hover:bg-indigo-50"}`}>{item}</button>)}</nav>
        <main className="min-w-0">
          <div className="mb-7"><p className="mb-2 text-sm font-semibold uppercase tracking-widest text-indigo-600">Learn languages naturally</p><h1 className="text-3xl font-bold tracking-tight md:text-4xl">{section === "Translate" ? "More than a translation." : section}</h1><p className="mt-3 text-slate-500">{section === "Translate" ? "Understand the words, grammar, and meaning behind every phrase." : "Your personal German and English learning space."}</p></div>
          {section === "Translate" ? <div className="space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-3"><label htmlFor="direction" className="text-sm font-medium">Translate</label><select id="direction" value={direction} onChange={(e) => { setDirection(e.target.value as "en-de" | "de-en"); setResult(null); }} className="rounded-lg border border-slate-200 p-2 text-sm"><option value="en-de">English → German</option><option value="de-en">German → English</option></select></div>
              <label htmlFor="source" className="sr-only">Text to translate</label><textarea id="source" value={text} onChange={(e) => setText(e.target.value)} placeholder={direction === "en-de" ? "Type an English phrase…" : "Schreibe einen deutschen Satz…"} className="min-h-36 w-full resize-y rounded-xl border border-slate-200 p-4 outline-none focus:border-indigo-500" />
              <div className="mt-4 flex justify-end"><button disabled={!text.trim()} onClick={translate} className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-40">Translate →</button></div>
            </section>
            {message && <p role="status" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{message}</p>}
            {result && <section aria-live="polite" className="space-y-4 rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm"><p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Translation</p><p className="text-2xl font-semibold">{direction === "en-de" ? result.german : result.english}</p><div className="border-t border-slate-100 pt-4"><h2 className="font-semibold">Grammar insight</h2><p className="mt-2 text-slate-600">{result.note}</p></div><div><h2 className="font-semibold">In context</h2><ul className="mt-2 space-y-2 text-sm text-slate-600">{result.examples.map((example) => <li key={example}>{example}</li>)}</ul></div><button onClick={() => setSaved((old) => old.some((entry) => entry.english === result.english) ? old : [...old, result])} className="rounded-lg border border-indigo-200 px-4 py-2 text-sm font-semibold text-indigo-700">{saved.some((entry) => entry.english === result.english) ? "✓ Saved for this session" : "＋ Save vocabulary"}</button></section>}
            <div><h2 className="mb-3 font-semibold">Try a sample phrase</h2><div className="flex flex-wrap gap-2">{entries.map((entry) => <button key={entry.english} onClick={() => { setDirection("en-de"); setText(entry.english); setResult(null); setMessage(""); }} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm hover:border-indigo-300">{entry.english}</button>)}</div></div>
          </div> : section === "Vocabulary" ? <section className="rounded-2xl bg-white p-6 shadow-sm"><h2 className="mb-4 text-lg font-semibold">Saved phrases ({saved.length})</h2>{saved.length ? saved.map((entry) => <div key={entry.english} className="border-t border-slate-100 py-3"><p className="font-medium">{entry.german}</p><p className="text-sm text-slate-500">{entry.english}</p></div>) : <p className="text-slate-500">Translate a sample phrase and save it to start your collection. Saved phrases are kept only until you refresh this demo.</p>}</section> : <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"><span className="text-3xl">✦</span><h2 className="mt-4 text-xl font-semibold">{section} is coming next</h2><p className="mt-2 text-slate-500">We are building this module step by step. Try the interactive Translate demo in the meantime.</p><button onClick={() => setSection("Translate")} className="mt-5 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white">Explore translations</button></section>}
        </main>
      </div>
    </div>
  );
}
