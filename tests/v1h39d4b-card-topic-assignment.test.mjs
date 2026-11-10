import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  parseTopicChange, topicCardUrl, topicCategoriesUrl, topicLinksUrl,
  topicInsertUrl, topicWriteUrl, parseTopicSnapshot, confirmTopicChange,
} from "../src/lib/admin/card-topics.mjs";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const route=read("../src/app/api/admin/cards/[id]/topics/route.ts");
const server=read("../src/lib/admin/server-card-topics.ts");
const ui=read("../src/app/admin/topics/[id]/page.tsx");
const admin=read("../src/app/admin/page.tsx");
const publicCategories=read("../src/app/api/categories/route.ts");
const id="11111111-1111-4111-8111-111111111111";
const cat1="22222222-2222-4222-8222-222222222222";
const cat2="33333333-3333-4333-8333-333333333333";
const base="https://project.supabase.co";
const card=[{id,term:"die Fahrkartenkontrolle",status:"draft"}];
const cats=[
  {id:cat1,slug:"travel-transport",name:"Travel & Transport",
    icon:"🚆",description:null,sort_order:70},
  {id:cat2,slug:"daily-life",name:"Daily Life",
    icon:"🏠",description:null,sort_order:10},
];
const links=[{card_id:id,category_id:cat1,sort_order:0}];

test("valid category link payload only accepts one UUID key",()=>{
  assert.deepEqual(parseTopicChange({categoryId:cat1}),{categoryId:cat1});
  for(const raw of [
    null,[],{}, {categoryId:"travel-transport"}, {categoryId:"bad"},
    {categoryId:cat1,cardId:id},{categoryId:cat1,status:"published"},
    {categoryId:cat1,sort_order:0},{categoryId:cat1,userId:id},
    {categoryId:null}, {categoryId:7},
  ])assert.equal(parseTopicChange(raw),null);
});
test("read URL never widens from a single selected card",()=>{
  const u=topicCardUrl(base,id);
  assert.equal(u.pathname,"/rest/v1/cards");
  assert.equal(u.searchParams.get("id"),"eq."+id);
  assert.equal(u.searchParams.get("limit"),"1");
  assert.equal(u.searchParams.get("select"),"id,term,status");
  assert.throws(()=>topicCardUrl(base,"bad"));
});
test("category reads are limited and ordered, including all published topic metadata",()=>{
  const u=topicCategoriesUrl(base);
  assert.equal(u.pathname,"/rest/v1/categories");
  assert.equal(u.searchParams.get("order"),"sort_order.asc,slug.asc");
  assert.equal(u.searchParams.get("limit"),"101");
  assert.equal(u.searchParams.get("select"),
    "id,slug,name,description,icon,sort_order");
});
test("membership read and filtered DELETE are pinned to exact UUIDs",()=>{
  const get=topicLinksUrl(base,id);
  assert.equal(get.pathname,"/rest/v1/card_categories");
  assert.equal(get.searchParams.get("card_id"),"eq."+id);
  assert.equal(get.searchParams.get("limit"),"101");
  const write=topicWriteUrl(base,id,cat1);
  assert.equal(write.searchParams.get("card_id"),"eq."+id);
  assert.equal(write.searchParams.get("category_id"),"eq."+cat1);
  assert.throws(()=>topicWriteUrl(base,id,"wrong"));
});
test("insert targets only the association table and never edits the card",()=>{
  const url=topicInsertUrl(base);
  assert.equal(url.pathname,"/rest/v1/card_categories");
  assert.equal(url.searchParams.get("select"),"card_id,category_id");
  assert.equal(url.searchParams.has("status"),false);
  for(const invalid of ["http://project.supabase.co",
    "https://user:password@project.supabase.co",
    "https://project.supabase.co/path",
    "https://project.supabase.co/?token=x"])
    assert.throws(()=>topicInsertUrl(invalid));
});
test("valid topic snapshot supports multi-category draft assignments",()=>{
  const result=parseTopicSnapshot(card,cats,links,id);
  assert.equal(result.card.status,"draft");
  assert.equal(result.card.term,"die Fahrkartenkontrolle");
  assert.equal(result.categories.length,2);
  assert.deepEqual(result.assignedIds,[cat1]);
  assert.deepEqual(result.categories[0],{
    id:cat1,slug:"travel-transport",name:"Travel & Transport",
    icon:"🚆",description:null,
  });
});
test("published, rejected and reviewed cards may have category metadata",()=>{
  for(const status of ["draft","review","published","rejected"]){
    assert.equal(parseTopicSnapshot([{...card[0],status}],cats,links,id).card.status,status);
  }
  assert.equal(parseTopicSnapshot([],cats,[],id),null);
});
test("unexpected or mismatched cards fail closed",()=>{
  for(const rows of [
    [{...card[0],id:cat1}],[{...card[0],status:"unknown"}],
    [{...card[0],term:""}],[...card,...card],
  ])assert.throws(()=>parseTopicSnapshot(rows,cats,links,id));
});
test("untrusted category IDs and malformed metadata are rejected",()=>{
  for(const modified of [
    [{...cats[0],id:"fake"},cats[1]],
    [cats[0],{...cats[0]}],
    [{...cats[0],slug:"bad slug"},cats[1]],
    [{...cats[0],name:""},cats[1]],
    [{...cats[0],sort_order:"first"},cats[1]],
  ])assert.throws(()=>parseTopicSnapshot(card,modified,links,id));
});
test("cross-card, unknown or duplicate memberships reject rather than display",()=>{
  for(const bad of [
    [{...links[0],card_id:cat2}],
    [{...links[0],category_id:id}],
    [...links,links[0]],
    [{...links[0],sort_order:null}],
  ])assert.throws(()=>parseTopicSnapshot(card,cats,bad,id));
});
test("oversized association queries fail closed instead of truncating",()=>{
  assert.throws(()=>parseTopicSnapshot(card,Array(101).fill(cats[0]),[],id));
  assert.throws(()=>parseTopicSnapshot(card,cats,Array(101).fill(links[0]),id));
  assert.throws(()=>parseTopicSnapshot([{},{}],cats,[],id));
});
test("DB writes must acknowledge exactly one matching relationship",()=>{
  assert.equal(confirmTopicChange([{card_id:id,category_id:cat1}],id,cat1),true);
  assert.equal(confirmTopicChange([],id,cat1),false);
  assert.equal(confirmTopicChange([{card_id:id,category_id:cat1},
    {card_id:id,category_id:cat1}],id,cat1),false);
  assert.equal(confirmTopicChange([{card_id:id,category_id:cat2}],id,cat1),false);
  assert.equal(confirmTopicChange([{card_id:cat2,category_id:cat1}],id,cat1),false);
});
test("read endpoint verifies admin identity before database query",()=>{
  assert.match(route,/export async function GET/);
  assert.match(route,/await checkAccess\(request\)/);
  assert.match(route,/await loadCardTopics\(id\)/);
  assert.match(route,/ENABLE_LEARNTRANSLATE_ADMIN_REVIEW_READ/);
  assert.match(route,/Cache-Control/);
  assert.doesNotMatch(route,/export async function PATCH/);
});
test("writes check auth, same origin, flag, bounded body and action",()=>{
  assert.match(route,/export async function POST/);
  assert.match(route,/export async function DELETE/);
  assert.match(route,/allowSameOriginWrite\(request\)/);
  assert.match(route,/ENABLE_LEARNTRANSLATE_ADMIN_CATEGORY_WRITE!=="true"/);
  assert.match(route,/readBoundedJson\(request,1024\)/);
  assert.match(route,/parseTopicChange\(body\)/);
  const a=route.indexOf("await checkAccess(request)",route.indexOf("async function change"));
  const b=route.indexOf("allowSameOriginWrite(request)",a);
  const c=route.indexOf("ENABLE_LEARNTRANSLATE_ADMIN_CATEGORY_WRITE",b);
  const d=route.indexOf("readBoundedJson(request,1024)",c);
  const e=route.indexOf("changeCardTopic(id,parsed.categoryId,action)",d);
  assert.ok(a>=0&&a<b&&b<c&&c<d&&d<e);
});
test("privileged service only modifies one association and is default-off",()=>{
  assert.match(server,/import "server-only"/);
  assert.match(server,/ENABLE_LEARNTRANSLATE_ADMIN_CATEGORY_WRITE !== "true"/);
  assert.match(server,/ENABLE_LEARNTRANSLATE_ADMIN_REVIEW_READ !== "true"/);
  assert.match(server,/SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(server,/topicWriteUrl\(base,cardId,categoryId\)/);
  assert.match(server,/JSON.stringify\(\{card_id:cardId,category_id:categoryId\}\)/);
  assert.match(server,/method:action==="add"\?"POST":"DELETE"/);
  assert.doesNotMatch(server,/method:"(PATCH|PUT)"/);
  assert.doesNotMatch(server,/\.upsert\(/);
});
test("category UI uses Suspense and server-authorized checkbox toggles",()=>{
  assert.match(ui,/Suspense/);
  assert.match(ui,/useParams/);
  assert.match(ui,/\/api\/admin\/access/);
  assert.match(ui,/checked=\{checked\}/);
  assert.match(ui,/method:wasAssigned\?"DELETE":"POST"/);
  assert.match(ui,/Drafts and review cards stay private/);
  assert.match(admin,/Assign topic categories/);
  assert.match(publicCategories,/status:"eq.published"/);
  assert.doesNotMatch(ui,/SUPABASE_SERVICE_ROLE_KEY/);
});
