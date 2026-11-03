"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { LearningCardContent } from "@/lib/cards/schema";
type Category = { id:string; slug:string; name:string; description?:string };
type Card = { id:string; term:string; type:"word"|"sentence"; content:LearningCardContent };
const icons:Record<string,string> = {
  "daily-life":"☀️","conversations":"💬","feelings-emotions":"💗","work-career":"💼",
  "shopping":"🛍️","food-restaurants":"🍽️","travel-transport":"🚆","health":"🌿",
  "housing":"🏡","education":"📚","technology":"💻","german-bureaucracy":"📋"
};
export default function CategoriesPage() {
  const [categories,setCategories]=useState<Category[]>([]);
  const [selected,setSelected]=useState<Category|null>(null);
  const [cards,setCards]=useState<Card[]>([]);
  const [expanded,setExpanded]=useState<string|null>(null);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    let active=true;
    fetch("/api/categories").then(async r=>{if(!r.ok)throw Error();return r.json()})
      .then(data=>{if(active)setCategories(data.categories)})
      .catch(()=>{if(active)setError("Categories are temporarily unavailable.")})
      .finally(()=>{if(active)setLoading(false)});
    return ()=>{active=false};
  },[]);
  async function open(category:Category) {
    setSelected(category);setCards([]);setExpanded(null);setLoading(true);setError("");
    try {
      const r=await fetch("/api/categories?slug="+encodeURIComponent(category.slug));
      if(!r.ok)throw Error();
      const data:{cards:Card[]}=await r.json();
      setCards(data.cards);
    } catch {setError("Could not load vocabulary. Please try again.");}
    finally {setLoading(false);}
  }
  function save(card:LearningCardContent) {
    try {
      const key="lt:cards:v1";
      const raw:unknown=JSON.parse(localStorage.getItem(key)||"[]");
      const old=Array.isArray(raw)?raw.filter((v):v is LearningCardContent=>v&&typeof v==="object"&&typeof v.term==="string"):[];
      const next=[...old.filter(v=>!(v.term===card.term&&v.type===card.type&&v.sourceLanguage===card.sourceLanguage)),card].slice(-200);
      localStorage.setItem(key,JSON.stringify(next));
      setError("Card saved on this device.");
    } catch {setError("Saving is unavailable on this device.");}
  }
  return <div className="min-h-screen bg-[#fffaf2] text-[#343d4a]">
    <header className="border-b-2 border-[#e8e0d6] bg-white/80"><div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-5"><Link href="/" className="text-xl font-black text-[#4f6c77]">✳ LearnTranslate</Link><nav className="flex gap-2 text-sm font-bold"><Link href="/" className="rounded-full px-3 py-2">Search</Link><a href="/categories" aria-current="page" className="rounded-full bg-[#e7f2ee] px-3 py-2">Categories</Link></nav></div></header>
    <main className="mx-auto max-w-4xl px-5 pb-20 pt-12">
      {selected ? <><button onClick={()=>{setSelected(null);setError("");}} className="mb-5 rounded-full bg-[#fff0d5] px-4 py-2 font-bold">← All categories</button><h1 className="text-3xl font-black">{icons[selected.slug]} {selected.name}</h1><p className="mt-2 text-[#68727b]">Vocabulary for real-life situations</p></> :
        <><span className="rounded-full bg-[#fbe7ba] px-4 py-2 text-xs font-bold uppercase tracking-wider">✦ Learn by situation</span><h1 className="mt-6 text-4xl font-black">Explore everyday <span className="text-[#668d84]">German.</span></h1><p className="mt-3 text-[#68727b]">Choose a topic and discover useful words and expressions.</p></>}
      {error && <p role="status" className="mt-6 rounded-2xl bg-[#fff0d5] p-4">{error}</p>}
      {loading && <p role="status" className="mt-8">Loading vocabulary…</p>}
      {!selected && <div className="mt-9 grid grid-cols-2 gap-4 sm:grid-cols-3">{categories.map((category,i)=><button key={category.id} onClick={()=>open(category)} className={`min-h-36 rounded-[26px] border-2 border-[#e4ddd1] p-5 text-left shadow-[4px_5px_0_#ebe4d9] transition-transform active:translate-y-1 ${i%3===0?"bg-[#e6f2ec]":i%3===1?"bg-[#fff0d5]":"bg-[#f5e9f1]"}`}><span className="text-3xl">{icons[category.slug]||"✦"}</span><span className="mt-4 block font-black">{category.name}</span><span className="mt-2 block text-xs text-[#6e7780]">Explore →</span></button>)}</div>}
      {selected && !loading && <div className="mt-8 space-y-4">{cards.length===0 && <p className="rounded-2xl bg-white p-5">No published cards in this category yet.</p>}{cards.map(card=><article key={card.id} className="overflow-hidden rounded-[26px] border-2 border-[#e4ddd1] bg-white shadow-[4px_5px_0_#ebe4d9]"><button onClick={()=>setExpanded(expanded===card.id?null:card.id)} aria-expanded={expanded===card.id} className="w-full p-5 text-left"><span className="text-xs font-bold uppercase text-[#668d84]">{card.type} card</span><h2 className="mt-2 text-xl font-black">{card.content.term}</h2><p className="mt-1 text-[#5e8279]">{card.content.translation}</p><span className="mt-3 block text-xs font-bold">{expanded===card.id?"Hide details ↑":"Explore card ↓"}</span></button>{expanded===card.id && <div className="space-y-4 border-t border-[#e8e0d6] p-5">{card.content.type==="word"?<><p className="rounded-xl bg-[#fff0d5] p-3 text-sm">{card.content.grammar.partOfSpeech}{card.content.grammar.article?" · "+card.content.grammar.article:""}{card.content.grammar.plural?" · Plural: "+card.content.grammar.plural:""}</p><h3 className="font-bold">Examples</h3>{card.content.examples.map((ex,i)=><div key={i} className="rounded-xl bg-[#f1f4fb] p-3 text-sm"><p className="font-semibold">{ex.source}</p><p className="mt-1 text-[#657180]">{ex.translation}</p></div>)}</>:<><p className="rounded-xl bg-[#fff0d5] p-3">{card.content.naturalMeaning}</p>{card.content.grammarBreakdown?.map((item,i)=><p key={i} className="rounded-xl bg-[#f1f4fb] p-3 text-sm">{item}</p>)}</>}<button onClick={()=>save(card.content)} className="rounded-xl bg-[#f8df9f] px-5 py-3 font-bold">♡ Save card</button></div>}</article>)}</div>}
    </main>
  </div>;
}
