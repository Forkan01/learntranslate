import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  validatePublishableContent, parseReviewTransition, reviewCardUrl,
  reviewPatchUrl, confirmReviewPatch, nextDraftVersion,
} from "../src/lib/admin/review-transition.mjs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const route = read("../src/app/api/admin/cards/[id]/review/route.ts");
const server = read("../src/lib/admin/server-review-transition.ts");
const dashboard = read("../src/app/admin/page.tsx");
const id = "11111111-1111-4111-8111-111111111111";
const updatedAt = "2026-11-08T19:56:34.480116+00:00";

function sentence(status = "draft") {
  return {
    id, type:"sentence", status, sourceLanguage:"de", targetLanguage:"en",
    term:"Es kommt mir bekannt vor.",updatedAt,
    content:{schemaVersion:1,type:"sentence",sourceLanguage:"de",targetLanguage:"en",
      term:"Es kommt mir bekannt vor.",translation:"It seems familiar to me.",
      naturalMeaning:"Used when something seems familiar.",
      grammarBreakdown:["The verb vorkommen is separable."]},
  };
}
function word(status = "draft") {
  return {
    id, type:"word", status,sourceLanguage:"de",targetLanguage:"en",
    term:"die Entscheidung",updatedAt,
    content:{schemaVersion:1,type:"word",sourceLanguage:"de",targetLanguage:"en",
      term:"die Entscheidung",translation:"decision",
      grammar:{partOfSpeech:"noun",article:"die",plural:"Entscheidungen"},
      examples:Array.from({length:5},(_,i)=>({source:"Beispiel "+i,translation:"Example "+i})),
      usageNotes:["A noun."]},
  };
}
function action(name,confirmed = name === "publish") {
  return { action:name,expectedUpdatedAt:updatedAt,confirmed };
}

test("complete sentence and five-example noun are structurally publishable",()=>{
  assert.deepEqual(validatePublishableContent(sentence()),[]);
  assert.deepEqual(validatePublishableContent(word()),[]);
  assert.deepEqual(validatePublishableContent({...word(),status:"review"}),[]);
});
test("no empty or missing meanings pass the review gate",()=>{
  const cases = [
    c=>{c.translation="";},
    c=>{c.naturalMeaning="";},
    c=>{c.grammarBreakdown=[""];},
    c=>{c.sourceLanguage="en";},
    c=>{c.term="different";},
  ];
  for (const change of cases) {
    const card=sentence();change(card.content);
    assert.ok(validatePublishableContent(card).length);
  }
});
test("noun article and plural plus exactly five complete bilingual examples required",()=>{
  const examples=[
    c=>{c.examples=[];},
    c=>{c.examples[1].translation="";},
    c=>{c.examples[0].source="";},
    c=>{c.grammar.article="";},
    c=>{c.grammar.plural="";},
    c=>{c.grammar.partOfSpeech="unknown";},
  ];
  for(const change of examples) {
    const card=word();change(card.content);
    assert.ok(validatePublishableContent(card).length);
  }
  const nonNoun=word(); nonNoun.content.grammar.partOfSpeech="verb";
  delete nonNoun.content.grammar.article;delete nonNoun.content.grammar.plural;
  assert.deepEqual(validatePublishableContent(nonNoun),[]);
});
test("a draft can submit only to review and never publish directly",()=>{
  assert.deepEqual(parseReviewTransition(action("submit",false),sentence()),
    {from:"draft",to:"review",expectedUpdatedAt:updatedAt,action:"submit"});
  assert.equal(parseReviewTransition(action("publish"),sentence()),null);
  assert.equal(parseReviewTransition(action("reject",false),sentence()),null);
});
test("review requires explicit human confirmation to publish",()=>{
  assert.deepEqual(parseReviewTransition(action("publish"),sentence("review")),
    {from:"review",to:"published",expectedUpdatedAt:updatedAt,action:"publish"});
  assert.equal(parseReviewTransition(action("publish",false),sentence("review")),null);
  assert.deepEqual(parseReviewTransition(action("reject",false),sentence("review")).to,"rejected");
});
test("rejected goes only to private draft, published is terminal",()=>{
  assert.equal(parseReviewTransition(action("revise",false),sentence("rejected")).to,"draft");
  assert.equal(parseReviewTransition(action("submit",false),sentence("rejected")),null);
  for (const act of ["submit","publish","reject","revise"])
    assert.equal(parseReviewTransition(action(act),sentence("published")),null);
});
test("reject unknown fields and forged statuses regardless of authenticated identity",()=>{
  for(const bad of [
    {...action("publish"),status:"published"},
    {...action("publish"),actorId:"admin"},
    {...action("publish"),confirmed:"true"},
    {...action("publish"),expectedUpdatedAt:"now"},
    {...action("publish"),action:"approve"},
    {...action("publish"),content:{}},
    {action:"publish",confirmed:true},
  ])assert.equal(parseReviewTransition(bad,sentence("review")),null);
});
test("read URL constrained to one specific UUID, PATCH URL locks status/version",()=>{
  const get=reviewCardUrl("https://sample.supabase.co",id);
  assert.equal(get.pathname,"/rest/v1/cards");
  assert.equal(get.searchParams.get("id"),"eq."+id);
  assert.equal(get.searchParams.get("limit"),"1");
  const patch=reviewPatchUrl("https://sample.supabase.co",id,"review",updatedAt);
  assert.equal(patch.searchParams.get("id"),"eq."+id);
  assert.equal(patch.searchParams.get("status"),"eq.review");
  assert.equal(patch.searchParams.get("updated_at"),"eq."+updatedAt);
  assert.throws(()=>reviewPatchUrl("https://sample.supabase.co",id,"all",updatedAt));
  assert.throws(()=>reviewCardUrl("http://sample.supabase.co",id));
  assert.throws(()=>reviewCardUrl("https://sample.supabase.co","bad"));
});
test("response confirms a single matching transition only",()=>{
  const card=sentence("review");
  const newTime=nextDraftVersion(updatedAt,Date.parse(updatedAt)+2000);
  const row={id,type:"sentence",term:card.term,status:"published",updated_at:newTime};
  assert.deepEqual(confirmReviewPatch([row],card,"published"),
    {id,status:"published",updatedAt:newTime});
  for(const bad of [
    [],[row,row],[{...row,status:"review"}],
    [{...row,id:"22222222-2222-4222-8222-222222222222"}],
    [{...row,updated_at:updatedAt}],
    [{...row,term:"forged"}],
  ]) assert.equal(confirmReviewPatch(bad,card,"published"),null);
});

test("API checks verified administrator before origin, body or storage",()=>{
  assert.match(route,/await resolveAdminAccess\(request\)/);
  assert.match(route,/allowSameOriginWrite\(request\)/);
  assert.match(route,/readBoundedJson\(request, 2048\)/);
  assert.match(route,/export async function POST/);
  assert.doesNotMatch(route,/export async function (PATCH|PUT|GET|DELETE)/);
  const admin=route.indexOf("await resolveAdminAccess(request)");
  const origin=route.indexOf("allowSameOriginWrite(request)");
  const flag=route.indexOf("ENABLE_LEARNTRANSLATE_ADMIN_REVIEW_WORKFLOW");
  const parse=route.indexOf("readBoundedJson(request, 2048)");
  const mutate=route.indexOf("applyAdminReviewTransition(id, body)");
  assert.ok(admin < origin && origin < flag && flag < parse && parse < mutate);
});
test("server uses no client-controlled status and new publish gate is default off",()=>{
  assert.match(server,/import "server-only"/);
  assert.match(server,/ENABLE_LEARNTRANSLATE_ADMIN_REVIEW_WORKFLOW !== "true"/);
  assert.match(server,/ENABLE_LEARNTRANSLATE_ADMIN_PUBLISH !== "true"/);
  assert.match(server,/ENABLE_LEARNTRANSLATE_ADMIN_REVIEW_READ !== "true"/);
  assert.match(server,/validatePublishableContent\(card\)/);
  assert.match(server,/JSON.stringify\(\{\s*status: action.to,\s*updated_at:/);
  assert.match(server,/method: "PATCH"/);
  assert.match(server,/reviewPatchUrl\(base, id, action.from, card.updatedAt\)/);
  assert.doesNotMatch(server,/method: "(POST|PUT|DELETE)"/);
});
test("dashboard requires explicit confirmation before public publishing",()=>{
  assert.match(dashboard,/checked=\{publishChecked\}/);
  assert.match(dashboard,/disabled=\{transitioning \|\| !publishChecked\}/);
  assert.match(dashboard,/I personally checked that this card is accurate/);
  assert.match(dashboard,/Submit completed card for review/);
  assert.match(dashboard,/Return to Draft for corrections/);
  assert.match(dashboard,/Publish to public Search/);
  assert.match(dashboard,/Reject card/);
  assert.match(dashboard,/Read-only preview/);
  assert.doesNotMatch(dashboard,/SUPABASE_SERVICE_ROLE_KEY/);
});
