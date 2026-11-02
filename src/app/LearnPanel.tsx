"use client";
import { useEffect, useState } from "react";

type Lesson = { id: string; level: string; title: string; goal: string; explanation: string; example: { en: string; de: string }; question: string; options: string[]; answer: number; reason: string; grammarFocus?: {pattern:string;explanation:string}; vocabulary?: {german:string;english:string;note:string}[]; extraExamples?: {en:string;de:string}[]; grammarHighlight?: string };
const lessons: Lesson[] = [
  { id:"a1-greetings", level:"A1", title:"Greetings and introductions", goal:"Introduce yourself and greet someone politely.", explanation:"Use 'Ich heiße …' for your name. 'Wie heißen Sie?' is formal; 'Wie heißt du?' is informal.", example:{en:"My name is Alex. What is your name?",de:"Ich heiße Alex. Wie heißen Sie?"}, question:"Which question is polite and formal?", options:["Wie heißt du?","Wie heißen Sie?","Wie geht's?"], answer:1, reason:"Sie is the formal form of address, with the verb heißen." },
  { id:"a2-perfect", level:"A2", title:"Talking about yesterday", goal:"Describe completed everyday actions.", explanation:"The conversational past (Perfekt) often uses haben or sein plus a past participle at the end. For example: Ich habe gearbeitet.", example:{en:"I worked yesterday.",de:"Ich habe gestern gearbeitet."}, question:"Complete: Ich ___ gestern gelernt.", options:["bin","habe","hat"], answer:1, reason:"Lernen forms the Perfekt with haben: ich habe gelernt." },
  { id:"b1-because", level:"B1", title:"Explaining reasons with weil", goal:"Give reasons in complete sentences.", explanation:"Weil introduces a subordinate clause. Its conjugated verb normally moves to the end: … weil ich Deutsch lernen möchte.", example:{en:"I am learning German because I want to work in Germany.",de:"Ich lerne Deutsch, weil ich in Deutschland arbeiten möchte."}, question:"Choose the correct word order.", options:["weil ich möchte Deutsch lernen","weil ich Deutsch lernen möchte","weil möchte ich Deutsch lernen"], answer:1, reason:"In a weil-clause, the conjugated verb möchte goes at the end." },
  { id:"b2-conjunctive", level:"B2", title:"Polite requests with Konjunktiv II", goal:"Make polite requests in professional situations.", explanation:"Könnten Sie …? and Würden Sie …? soften requests. Use the infinitive at the end of the clause.", example:{en:"Could you please send me the documents?",de:"Könnten Sie mir bitte die Unterlagen schicken?"}, question:"Which is the most polite request?", options:["Schicken Sie die Unterlagen!","Du schickst die Unterlagen.","Könnten Sie mir bitte die Unterlagen schicken?"], answer:2, reason:"Könnten Sie … bitte? is a polite formal request." },
  { id:"c1-nuance", level:"C1", title:"Expressing contrast precisely", goal:"Use nuanced connectors in formal German.", explanation:"Obwohl introduces a subordinate clause with verb-final word order. Dennoch is an adverb and usually triggers inversion when it starts a main clause.", example:{en:"Although it was difficult, I continued.",de:"Obwohl es schwierig war, habe ich weitergemacht."}, question:"Which sentence is grammatically correct?", options:["Obwohl es war schwierig, habe ich weitergemacht.","Obwohl es schwierig war, habe ich weitergemacht.","Obwohl es schwierig war, ich habe weitergemacht."], answer:1, reason:"Obwohl sends war to the end; after the subordinate clause, the main clause begins with habe." },
  { id:"a1-articles", level:"A1", title:"Noun gender and articles", goal:"Choose the correct definite article.", explanation:"German nouns have grammatical gender: der (masculine), die (feminine), das (neuter). Learn the article together with each noun.", example:{en:"The book is on the table.",de:"Das Buch liegt auf dem Tisch."}, question:"Which article belongs to Buch?", options:["der","die","das"], answer:2, reason:"Buch is neuter: das Buch." },
  { id:"a1-verbs", level:"A1", title:"Present tense verbs", goal:"Conjugate regular verbs with ich and du.", explanation:"Regular verbs usually take -e with ich and -st with du: ich lerne, du lernst.", example:{en:"I am learning German.",de:"Ich lerne Deutsch."}, question:"Complete: Du ___ Deutsch.", options:["lernst","lerne","lernen"], answer:0, reason:"Du takes the -st ending: du lernst." },
  { id:"a1-negation", level:"A1", title:"Negation with nicht and kein", goal:"Make simple negative sentences.", explanation:"Use kein to negate an indefinite noun, and nicht for verbs or other parts of a sentence.", example:{en:"I do not have a car.",de:"Ich habe kein Auto."}, question:"Complete: Ich habe ___ Zeit.", options:["nicht","keine","kein"], answer:1, reason:"Zeit is feminine; the accusative form is keine Zeit." },
  { id:"a2-dative", level:"A2", title:"Dative after mit", goal:"Use dative articles with common prepositions.", explanation:"Mit always takes dative. Der becomes dem, die becomes der, and das becomes dem.", example:{en:"I am travelling with my friend.",de:"Ich fahre mit meinem Freund."}, question:"Complete: Ich fahre mit ___ Bus.", options:["der","den","dem"], answer:2, reason:"Mit requires dative: mit dem Bus." },
  { id:"a2-separable", level:"A2", title:"Separable verbs", goal:"Use everyday verbs such as aufstehen.", explanation:"In a main clause, the prefix separates and moves to the end: Ich stehe um sieben Uhr auf.", example:{en:"I get up at seven.",de:"Ich stehe um sieben Uhr auf."}, question:"Choose the correct sentence.", options:["Ich aufstehe um sieben Uhr.","Ich stehe um sieben Uhr auf.","Ich stehe auf um sieben Uhr."], answer:1, reason:"The conjugated stem is in second position and the prefix auf goes at the end." },
  { id:"a2-comparison", level:"A2", title:"Comparing things", goal:"Use comparative adjectives naturally.", explanation:"Many adjectives add -er in the comparative; use als to compare two things: schneller als.", example:{en:"The train is faster than the bus.",de:"Der Zug ist schneller als der Bus."}, question:"Complete: Mein Fahrrad ist ___ als deins.", options:["schnell","schneller","am schnellsten"], answer:1, reason:"Use the comparative schneller with als." },
  { id:"b1-relative", level:"B1", title:"Relative clauses", goal:"Describe people and objects more precisely.", explanation:"A relative clause gives extra information about a noun. The finite verb goes to the end.", example:{en:"This is the woman who works here.",de:"Das ist die Frau, die hier arbeitet."}, question:"Complete: Das ist der Mann, ___ hier wohnt.", options:["der","den","dem"], answer:0, reason:"Der is the masculine nominative relative pronoun, subject of wohnt." },
  { id:"b1-infinitive", level:"B1", title:"Purpose with um … zu", goal:"Explain why you do something.", explanation:"Use um … zu + infinitive when the subject of both clauses is the same.", example:{en:"I study German to find a job.",de:"Ich lerne Deutsch, um eine Arbeit zu finden."}, question:"Which sentence is correct?", options:["Ich lerne Deutsch, um Arbeit finden.","Ich lerne Deutsch, um Arbeit zu finden.","Ich lerne Deutsch, um zu Arbeit finden."], answer:1, reason:"The infinitive follows zu: um Arbeit zu finden." },
  { id:"b2-passive", level:"B2", title:"Passive voice at work", goal:"Describe processes without naming the actor.", explanation:"The present passive uses werden + past participle: Die Unterlagen werden geprüft.", example:{en:"The documents are being checked.",de:"Die Unterlagen werden geprüft."}, question:"Complete: Die E-Mail ___ heute verschickt.", options:["wird","werden","ist"], answer:0, reason:"The singular subject Die E-Mail takes wird verschickt." },
  { id:"b2-indirect", level:"B2", title:"Reported speech", goal:"Recognize formal indirect speech.", explanation:"Formal German often uses Konjunktiv I to report someone else's statement without endorsing it.", example:{en:"He says that he is sick.",de:"Er sagt, er sei krank."}, question:"Which form is typical in formal reported speech?", options:["er ist krank","er sei krank","er wäre krank gewesen"], answer:1, reason:"Sei is Konjunktiv I of sein, commonly used for reported speech." }
];
const KEY="lt:lessons-completed:v1";
const GRAMMAR_KEY="lt:grammar-practice:v1";
type GrammarStat={attempts:number;correct:number;updated:number;title:string;level:string;recent?:boolean[]};
function mastery(stat:GrammarStat):boolean {
  return (stat.recent?.length||0)>=3 && stat.recent!.slice(-3).every(Boolean);
}
function reviewDifficulty(stat:GrammarStat):"reinforce"|"standard"|"challenge" {
  const recent=stat.recent||[];
  if(recent.length<2 || recent.slice(-2).some(correct=>!correct)) return "reinforce";
  return recent.slice(-3).every(Boolean)&&recent.length>=3?"challenge":"standard";
}
function grammarId(lesson:Lesson):string {
  return lesson.id==="ai-personalized"
    ? "ai:"+lesson.level+":"+(lesson.grammarHighlight||lesson.grammarFocus?.pattern||lesson.title).toLocaleLowerCase("de").trim().slice(0,90)
    : lesson.id;
}
function recordGrammarAnswer(lesson:Lesson,correct:boolean) {
  try {
    const raw:unknown=JSON.parse(localStorage.getItem(GRAMMAR_KEY)||"{}");
    const stats:Record<string,GrammarStat>={};
    if(raw&&typeof raw==="object"&&!Array.isArray(raw)) {
      for(const [id,value] of Object.entries(raw)) {
        if(value&&typeof value==="object"&&"attempts" in value&&"correct" in value&&"updated" in value&&"title" in value&&"level" in value&&
          typeof value.attempts==="number"&&Number.isFinite(value.attempts)&&typeof value.correct==="number"&&Number.isFinite(value.correct)&&
          typeof value.updated==="number"&&Number.isFinite(value.updated)&&typeof value.title==="string"&&typeof value.level==="string") stats[id]=value as GrammarStat;
      }
    }
    const id=grammarId(lesson),prev=stats[id];
    stats[id]={attempts:Math.min(100000,(prev?.attempts||0)+1),correct:Math.min(100000,(prev?.correct||0)+Number(correct)),updated:Date.now(),title:lesson.grammarFocus?.pattern||lesson.title,level:lesson.level,recent:[...(prev?.recent||[]).filter(x=>typeof x==="boolean").slice(-4),correct]};
    const limited=Object.entries(stats).sort((a,b)=>b[1].updated-a[1].updated).slice(0,150);
    localStorage.setItem(GRAMMAR_KEY,JSON.stringify(Object.fromEntries(limited)));
  } catch { /* Browser storage is optional. */ }
}
export default function LearnPanel({ onSavePhrase, savedPhrases }: { onSavePhrase: (phrase: {en:string;de:string})=>void; savedPhrases:{en:string;de:string}[] }) {
  const [selected,setSelected]=useState(0);
  const [reviewTarget,setReviewTarget]=useState<string|null>(null);
  const [reviewStats,setReviewStats]=useState<Record<string,GrammarStat>>({});
  const [reviewMode,setReviewMode]=useState(false);
  const [topic,setTopic]=useState("");
  const [aiLevel,setAiLevel]=useState("B2");
  const [generated,setGenerated]=useState<Lesson|null>(null);
  const [generating,setGenerating]=useState(false);
  const [generationError,setGenerationError]=useState("");
  const [showGenerated,setShowGenerated]=useState(false);
  const [speechError,setSpeechError]=useState("");
  function speakGerman(value:string) {
    setSpeechError("");
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      setSpeechError("Pronunciation is not supported on this device.");return;
    }
    window.speechSynthesis.cancel();
    const utterance=new SpeechSynthesisUtterance(value);
    utterance.lang="de-DE";utterance.rate=0.85;
    utterance.onerror=()=>setSpeechError("German speech is unavailable. Check your device's text-to-speech settings.");
    window.speechSynthesis.speak(utterance);
  }
  async function generateLesson(reviewLesson?:Lesson) {
    if ((!reviewLesson&&!topic.trim()) || generating) return;
    setGenerating(true);setGenerationError("");setGenerated(null);setChoice(null);
    try {
      const response=await fetch("/api/lessons",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(reviewLesson?{level:reviewLesson.level,topic:reviewLesson.title,review:{focus:reviewLesson.grammarFocus?.pattern||reviewLesson.title,difficulty:reviewDifficulty(reviewStats[reviewLesson.id]||{attempts:0,correct:0,updated:0,title:"",level:reviewLesson.level})}}:{level:aiLevel,topic:topic.trim()})});
      if (!response.ok) throw new Error("Lesson unavailable");
      const data: {lesson:Lesson}=await response.json();
      setGenerated({...data.lesson,id:"ai-personalized",level:reviewLesson?.level||aiLevel});setReviewMode(!!reviewLesson);setShowGenerated(true);
    } catch {setGenerationError("AI lesson generation is unavailable right now. Your guided lessons still work.");}
    finally {setGenerating(false);}
  }
  const [levelFilter,setLevelFilter]=useState("All");
  const [choice,setChoice]=useState<number|null>(null);
  const [completed,setCompleted]=useState<string[]>([]);
  const [ready,setReady]=useState(false);
  useEffect(()=>{const timer=window.setTimeout(()=>{try{const value:unknown=JSON.parse(localStorage.getItem(KEY)||"[]");if(Array.isArray(value))setCompleted(value.filter((x):x is string=>typeof x==="string").slice(0,100));}catch{}
    try{
      const raw:unknown=JSON.parse(localStorage.getItem(GRAMMAR_KEY)||"{}");
      if(raw&&typeof raw==="object"&&!Array.isArray(raw)){
        const candidates=lessons.map(item=>({item,stat:(raw as Record<string,unknown>)[item.id]})).filter((x):x is {item:Lesson;stat:GrammarStat}=>{
          const v=x.stat;
          return !!v&&typeof v==="object"&&"attempts" in v&&"correct" in v&&typeof v.attempts==="number"&&v.attempts>0&&typeof v.correct==="number"&&v.correct<v.attempts;
        }).sort((a,b)=>(a.stat.correct/a.stat.attempts)-(b.stat.correct/b.stat.attempts));
        const stats:Record<string,GrammarStat>={};
        for(const [id,v] of Object.entries(raw))if(v&&typeof v==="object"&&"attempts" in v&&"correct" in v&&"title" in v&&"level" in v&&
          typeof v.attempts==="number"&&typeof v.correct==="number"&&typeof v.title==="string"&&typeof v.level==="string")stats[id]=v as GrammarStat;
        setReviewStats(stats);
        const eligible=candidates.filter(({stat})=>!mastery(stat));
        if(eligible.length)setReviewTarget(eligible[0].item.id);
      }
    }catch{}
    setReady(true);},0);return()=>window.clearTimeout(timer);},[]);
  useEffect(()=>{if(ready)try{localStorage.setItem(KEY,JSON.stringify(completed));}catch{}},[completed,ready]);
  const lesson=showGenerated&&generated?generated:lessons[selected];
  const saved=savedPhrases.some(p=>p.en===lesson.example.en);
  const passed=choice===lesson.answer;
  const isGenerated=showGenerated&&!!generated;
  function highlightedGerman(sentence:string) {
    const target=isGenerated?lesson.grammarHighlight:undefined;
    if (!target || !sentence.includes(target)) return sentence;
    const index=sentence.indexOf(target);
    return <>{sentence.slice(0,index)}<mark className="rounded bg-amber-200 px-1 font-bold text-slate-900">{target}</mark>{sentence.slice(index+target.length)}</>;
  }
  return <div className="space-y-5">
    <section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="text-xl font-semibold">Guided German lessons</h2><p className="mt-2 text-sm text-slate-600">Fifteen guided lessons across A1–C1. Choose a level, learn a rule, then answer a question.</p><p className="mt-3 text-sm font-medium text-indigo-700">{completed.length} of {lessons.length} completed</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-indigo-600" style={{width:completed.length/lessons.length*100+"%"}} /></div></section>
    <section className="rounded-2xl bg-white p-5 shadow-sm space-y-3"><h2 className="text-xl font-semibold">✦ Create a personalized AI lesson</h2><p className="text-sm text-slate-600">Choose a level and topic. Gemini creates a grammar pattern, vocabulary, bilingual examples, and a quick exercise.</p><label htmlFor="ai-level" className="block text-sm font-semibold">German level</label><select id="ai-level" value={aiLevel} onChange={e=>setAiLevel(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white p-3">{["A1","A2","B1","B2","C1"].map(level=><option key={level} value={level}>{level}</option>)}</select><label htmlFor="ai-topic" className="block text-sm font-semibold">What do you want to learn?</label><input id="ai-topic" value={topic} maxLength={120} onChange={e=>setTopic(e.target.value)} placeholder="e.g. German job interviews" className="w-full rounded-lg border border-slate-200 p-3"/><button type="button" disabled={!topic.trim()||generating} onClick={()=>void generateLesson()} className="rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white disabled:opacity-40">{generating?"Generating…":"Generate lesson ✦"}</button>{generationError&&<p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{generationError}</p>}{generated&&<button type="button" onClick={()=>{setShowGenerated(true);setChoice(null);}} className="block text-sm font-semibold text-indigo-700">View generated lesson →</button>}<p className="text-xs text-slate-500">AI lessons require an internet connection. Generated lessons are temporary; guided lesson progress stays saved.</p></section>
    {reviewTarget&&<div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="font-semibold text-amber-950">↻ Recommended grammar review</p><p className="mt-1 text-sm text-amber-900">Based on your earlier quiz mistakes: {lessons.find(item=>item.id===reviewTarget)?.title}</p><button type="button" className="mt-3 rounded-lg bg-amber-900 px-4 py-2 text-sm font-semibold text-white" onClick={()=>{const i=lessons.findIndex(item=>item.id===reviewTarget);if(i>=0){setSelected(i);setShowGenerated(false);setChoice(null);setLevelFilter("All");}}}>Review this lesson →</button><button type="button" disabled={generating} onClick={()=>{const target=lessons.find(item=>item.id===reviewTarget);if(target)void generateLesson(target);}} className="ml-2 mt-3 rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{generating?"Generating…":"✦ Generate targeted practice"}</button><p className="mt-2 text-xs text-amber-900">Adaptive difficulty: {reviewDifficulty(reviewStats[reviewTarget]||{attempts:0,correct:0,updated:0,title:"",level:""})}. Three recent correct attempts mark this topic mastered. AI generation uses your existing provider.</p></div>}
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filter lessons by level">{["All","A1","A2","B1","B2","C1"].map(level=><button key={level} type="button" aria-pressed={levelFilter===level} onClick={()=>setLevelFilter(level)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${levelFilter===level?"bg-indigo-600 text-white":"bg-white text-slate-700 border border-slate-200"}`}>{level}</button>)}</div>
    <div className="grid gap-2 sm:grid-cols-2">{lessons.map((item,index)=>({item,index})).filter(({item})=>levelFilter==="All"||item.level===levelFilter).map(({item,index})=><button type="button" key={item.id} onClick={()=>{setSelected(index);setShowGenerated(false);setChoice(null);}} aria-pressed={selected===index} className={`rounded-xl border p-4 text-left ${selected===index?"border-indigo-600 bg-indigo-50":"border-slate-200 bg-white"}`}><span className="text-xs font-bold text-indigo-700">{item.level} {completed.includes(item.id)?"· ✓ Completed":""}</span><span className="mt-1 block font-semibold">{item.title}</span></button>)}</div>
    <section className="space-y-5 rounded-2xl bg-white p-6 shadow-sm"><div><p className="text-xs font-bold uppercase tracking-widest text-indigo-700">{lesson.level} · {isGenerated?(reviewMode?"Targeted grammar practice":"Personalized lesson"):`Lesson ${lessons.filter((item,index)=>index<=selected&&item.level===lesson.level).length}`}</p><h2 className="mt-2 text-2xl font-bold">{lesson.title}</h2><p className="mt-2 text-slate-600">{lesson.goal}</p></div>
      {isGenerated&&<div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-indigo-700"><span className="rounded-full bg-indigo-50 px-3 py-2">1 · Learn the rule</span><span className="rounded-full bg-indigo-50 px-3 py-2">2 · Explore examples</span><span className="rounded-full bg-indigo-50 px-3 py-2">3 · Practice</span></div>}
      <div><h3 className="font-semibold">Learn the rule</h3><p className="mt-2 leading-relaxed text-slate-700">{lesson.explanation}</p></div>
      {isGenerated&&lesson.grammarFocus&&<div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4"><h3 className="font-semibold">Grammar pattern</h3><p className="mt-2 font-semibold text-indigo-950">{lesson.grammarFocus.pattern}</p><p className="mt-2 text-sm leading-relaxed text-slate-700">{lesson.grammarFocus.explanation}</p></div>}
      {isGenerated&&lesson.vocabulary&&<div><h3 className="font-semibold">Key vocabulary · explore</h3><ul className="mt-3 grid gap-2 sm:grid-cols-2">{lesson.vocabulary.map((item,index)=><li key={index} className="rounded-xl border border-slate-200 p-3"><div className="flex items-start justify-between gap-2"><strong className="text-indigo-900">{item.german}</strong><button type="button" onClick={()=>speakGerman(item.german)} aria-label={`Listen to ${item.german}`} className="rounded-lg border border-indigo-200 px-2 py-1 text-sm">🔊</button></div><p className="text-sm">{item.english}</p>{item.note&&<p className="mt-1 text-xs text-slate-500">{item.note}</p>}</li>)}</ul></div>}
      <div className="rounded-xl bg-indigo-50 p-4"><p className="text-sm text-slate-600">{lesson.example.en}</p><p className="mt-2 font-semibold text-indigo-950">{highlightedGerman(lesson.example.de)}</p><button type="button" onClick={()=>speakGerman(lesson.example.de)} className="mt-3 mr-2 rounded-lg border border-indigo-300 bg-white px-3 py-2 text-sm text-indigo-800">🔊 Listen</button><button type="button" onClick={()=>onSavePhrase(lesson.example)} disabled={saved} className="mt-3 rounded-lg border border-indigo-300 bg-white px-3 py-2 text-sm text-indigo-800 disabled:opacity-60">{saved?"✓ Saved to Vocabulary":"＋ Save example phrase"}</button></div>
      {isGenerated&&lesson.extraExamples&&<div><h3 className="font-semibold">More examples · listen and save</h3><div className="mt-3 space-y-3">{lesson.extraExamples.map((item,index)=><div key={index} className="rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-500">{item.en}</p><p className="mt-1 font-medium">{item.de}</p><div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={()=>speakGerman(item.de)} className="rounded-lg border border-indigo-200 px-3 py-2 text-sm text-indigo-800">🔊 Listen</button><button type="button" onClick={()=>onSavePhrase(item)} disabled={savedPhrases.some(p=>p.en===item.en)} className="rounded-lg border border-indigo-200 px-3 py-2 text-sm text-indigo-800 disabled:opacity-50">{savedPhrases.some(p=>p.en===item.en)?"✓ Saved":"＋ Save phrase"}</button></div></div>)}</div></div>}
      {speechError&&<p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{speechError}</p>}
      <div><h3 className="font-semibold">Check your understanding · practice</h3><p className="mt-2 text-slate-700">{lesson.question}</p><div className="mt-3 space-y-2">{lesson.options.map((option,index)=><button key={index} type="button" disabled={passed} onClick={()=>{recordGrammarAnswer(lesson,index===lesson.answer);setChoice(index);if(index===lesson.answer&&!isGenerated)setCompleted(old=>old.includes(lesson.id)?old:[...old,lesson.id]);}} className={`block w-full rounded-lg border p-3 text-left text-sm ${choice===index?(passed?"border-green-500 bg-green-50":"border-amber-500 bg-amber-50"):"border-slate-200 bg-white"}`}>{option}</button>)}</div>{choice!==null&&<p role="status" className={`mt-3 rounded-lg p-3 text-sm ${passed?"bg-green-50 text-green-900":"bg-amber-50 text-amber-900"}`}>{passed?"Correct! "+lesson.reason:"Not quite. Try again. Review the grammar pattern above."}</p>}</div>
      <div className="flex justify-end"><button type="button" disabled={!passed||(!isGenerated&&selected===lessons.length-1)} onClick={()=>{setShowGenerated(false);setSelected(i=>isGenerated?i:Math.min(i+1,lessons.length-1));setChoice(null);setLevelFilter("All");}} className="rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white disabled:opacity-40">{isGenerated?"Back to guided lessons →":"Next lesson →"}</button></div>
    </section><p className="text-xs text-slate-500">The 15 guided lessons and their completion records work offline. AI-generated lessons require Gemini and are not saved automatically.</p>
  </div>;
}
