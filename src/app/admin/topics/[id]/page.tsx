"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type TopicSnapshot = {
  card:{id:string;term:string;status:"draft"|"review"|"published"|"rejected"};
  categories:Array<{id:string;slug:string;name:string;description:string|null;icon:string|null}>;
  assignedIds:string[];
};
type Phase="loading"|"ready"|"denied"|"unavailable";

function TopicEditorContent() {
  const params=useParams<{id:string}>();
  const cardId=params.id;
  const [phase,setPhase]=useState<Phase>("loading");
  const [data,setData]=useState<TopicSnapshot|null>(null);
  const [nonce,setNonce]=useState(0);
  const [busy,setBusy]=useState<string|null>(null);
  const [message,setMessage]=useState("");
  const locked=useRef(false);

  useEffect(()=>{
    const controller=new AbortController();
    void (async()=>{
      await Promise.resolve();
      if(controller.signal.aborted)return;
      setPhase("loading");
      try {
        const access=await fetch("/api/admin/access",{
          cache:"no-store",credentials:"same-origin",signal:controller.signal,
        });
        if(!access.ok) {
          if(!controller.signal.aborted)setPhase("denied");
          return;
        }
        const auth:unknown=await access.json();
        if(!auth||typeof auth!=="object"||!("authorized" in auth) ||
            auth.authorized!==true){
          if(!controller.signal.aborted)setPhase("denied");
          return;
        }
        const response=await fetch("/api/admin/cards/"+encodeURIComponent(cardId)+"/topics",{
          cache:"no-store",credentials:"same-origin",signal:controller.signal,
        });
        if(!response.ok)throw new Error("Topics unavailable");
        const snapshot:TopicSnapshot=await response.json();
        if(controller.signal.aborted)return;
        if(snapshot.card?.id!==cardId || !Array.isArray(snapshot.categories) ||
            !Array.isArray(snapshot.assignedIds))throw new Error("Unexpected topics response");
        setData(snapshot);
        setPhase("ready");
      }catch{
        if(!controller.signal.aborted)setPhase("unavailable");
      }
    })();
    return()=>controller.abort();
  },[cardId,nonce]);

  async function changeTopic(categoryId:string,wasAssigned:boolean) {
    if(locked.current||phase!=="ready")return;
    locked.current=true;
    setBusy(categoryId);
    setMessage("");
    try{
      const response=await fetch("/api/admin/cards/"+encodeURIComponent(cardId)+"/topics",{
        method:wasAssigned?"DELETE":"POST",credentials:"same-origin",cache:"no-store",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({categoryId}),
      });
      if(response.ok){
        const confirmed:{cardId?:string;categoryId?:string;assigned?:boolean}=await response.json();
        if(confirmed.cardId!==cardId||confirmed.categoryId!==categoryId||
            confirmed.assigned!==!wasAssigned)throw new Error("Unexpected response");
        setMessage(wasAssigned?"Topic removed.":"Topic assigned.");
        setNonce(n=>n+1);
      }else if(response.status===404||response.status===503){
        setMessage("Topic editing is disabled or unavailable. Reload before retrying.");
      }else if(response.status===409){
        setMessage("Topic was already changed. Reload to see its current state.");
        setNonce(n=>n+1);
      }else{
        setMessage("Topic update denied. Check your administrator session.");
      }
    }catch{
      setMessage("The outcome is uncertain. Reload and inspect topics before retrying.");
    }finally{
      locked.current=false;
      setBusy(null);
    }
  }

  return(
    <main className="min-h-screen bg-[#fffaf2] px-4 py-10 text-[#343d4a] sm:px-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/admin" className="text-sm font-black text-[#4f6c77]">← Back to admin dashboard</Link>
        <section className="mt-7 rounded-[30px] border-2 border-[#d9d4c9] bg-white p-5 shadow-[6px_7px_0_#e8e1d6] sm:p-8">
          <span className="rounded-full bg-[#e6f2ec] px-4 py-2 text-xs font-black uppercase tracking-wider">✦ Private workspace</span>
          <h1 className="mt-6 text-3xl font-black">Card topics</h1>
          {phase==="loading"&&<p role="status" className="mt-5">Loading card and topic assignments…</p>}
          {phase==="denied"&&<p role="alert" className="mt-5">Administrator sign-in is required.</p>}
          {phase==="unavailable"&&<p role="alert" className="mt-5">Card topics could not be loaded. Check private database permissions.</p>}
          {phase==="ready"&&data&&(
            <>
              <h2 className="mt-5 break-words text-xl font-black">{data.card.term}</h2>
              <p className="mt-1 text-sm text-[#64717a]">
                Status: <strong>{data.card.status}</strong> · {data.assignedIds.length} topics assigned
              </p>
              <p className="mt-4 rounded-2xl bg-[#edf4f0] p-4 text-sm">
                A card can belong to several situations. Drafts and review cards stay private.
                Changing topics on a published card updates public category browsing immediately.
                This does not edit or publish the card itself.
              </p>
              {message&&<p role="status" className="mt-4 rounded-2xl border border-[#b9cec1] p-3 text-sm">{message}</p>}
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {data.categories.map(category=>{
                  const checked=data.assignedIds.includes(category.id);
                  return(
                    <label key={category.id} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#dfded4] bg-[#fbfaf7] p-4">
                      <input type="checkbox" checked={checked} disabled={busy!==null}
                        onChange={()=>void changeTopic(category.id,checked)}
                        className="mt-1 h-4 w-4 accent-[#668d84]" />
                      <span className="min-w-0">
                        <span className="block text-sm font-black">{category.name}</span>
                        {category.description&&<span className="mt-1 block text-xs text-[#64717a]">{category.description}</span>}
                      </span>
                    </label>
                  );
                })}
              </div>
              {busy&&<p role="status" className="mt-4 text-sm">Saving topic change…</p>}
              <div className="mt-6 flex flex-wrap gap-3">
                <button type="button" disabled={busy!==null}
                  onClick={()=>{setMessage("");setNonce(n=>n+1);}}
                  className="rounded-xl border px-4 py-3 text-sm font-bold disabled:opacity-50">
                  Refresh assignments
                </button>
                <Link href="/admin" className="rounded-xl bg-[#668d84] px-5 py-3 text-sm font-black text-white">
                  Done — Back to cards
                </Link>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

export default function AdminCardTopicsPage() {
  return (
    <Suspense fallback={<main className="min-h-screen p-8">Loading topic editor…</main>}>
      <TopicEditorContent />
    </Suspense>
  );
}
