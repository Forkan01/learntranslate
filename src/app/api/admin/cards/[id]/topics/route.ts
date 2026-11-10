import { NextRequest, NextResponse } from "next/server";
import { resolveAdminAccess } from "@/lib/admin/server-admin-access";
import { allowSameOriginWrite } from "@/lib/cards/same-origin-write";
import { readBoundedJson } from "@/lib/cards/bounded-json";
import { validDraftId } from "@/lib/admin/edit-draft.mjs";
import { parseTopicChange } from "@/lib/admin/card-topics.mjs";
import {
  loadCardTopics, changeCardTopic, CardTopicsUnavailable,
  CardTopicsConflict, CardTopicsInvalid,
} from "@/lib/admin/server-card-topics";

type Context={params:Promise<{id:string}>};
const headers={"Cache-Control":"private, no-store, max-age=0",Vary:"Cookie"};
const error=(status:number,message:string)=>
  NextResponse.json({error:message},{status,headers});

async function checkAccess(request:NextRequest) {
  const state=await resolveAdminAccess(request);
  if (state==="disabled") return error(404,"Not available");
  if (state==="unauthenticated") return error(401,"Sign in required");
  if (state!=="allowed") return error(403,"Not authorized");
  return null;
}

/** Private read for a single selected card; includes unpublished assignments. */
export async function GET(request:NextRequest,context:Context) {
  const rejected=await checkAccess(request);
  if (rejected) return rejected;
  if (process.env.ENABLE_LEARNTRANSLATE_ADMIN_REVIEW_READ!=="true")
    return error(404,"Admin card reads disabled");
  const {id}=await context.params;
  if (!validDraftId(id)) return error(404,"Card not found");
  try {
    const data=await loadCardTopics(id);
    return data ? NextResponse.json(data,{headers}) : error(404,"Card not found");
  } catch {
    return error(503,"Topic details unavailable");
  }
}

/** Every add/remove reauthenticates admin identity and revalidates the category. */
async function change(request:NextRequest,context:Context,action:"add"|"remove") {
  const rejected=await checkAccess(request);
  if (rejected) return rejected;
  if (!allowSameOriginWrite(request)) return error(403,"Invalid origin");
  if (process.env.ENABLE_LEARNTRANSLATE_ADMIN_CATEGORY_WRITE!=="true")
    return error(404,"Category writing disabled");
  const {id}=await context.params;
  if (!validDraftId(id)) return error(404,"Card not found");
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase()!=="application/json")
    return error(415,"JSON required");
  let body:unknown;
  try {body=await readBoundedJson(request,1024);}
  catch {return error(400,"Invalid request");}
  const parsed=parseTopicChange(body);
  if (!parsed) return error(400,"Invalid category");
  try {
    const result=await changeCardTopic(id,parsed.categoryId,action);
    if (!result) return error(404,"Card not found");
    if (result.kind==="conflict")
      return error(409,"Topic selection changed. Refresh and try again.");
    return NextResponse.json({
      cardId:id,categoryId:parsed.categoryId,assigned:result.assigned,
    },{status:200,headers});
  } catch (e) {
    if (e instanceof CardTopicsInvalid) return error(400,"Invalid topic selection");
    if (e instanceof CardTopicsConflict) return error(409,"Topic is already assigned or changed");
    if (e instanceof CardTopicsUnavailable) return error(503,"Topic change unavailable. Reload before retrying.");
    return error(503,"Topic change unavailable");
  }
}

export async function POST(request:NextRequest,context:Context) {
  return change(request,context,"add");
}
export async function DELETE(request:NextRequest,context:Context) {
  return change(request,context,"remove");
}
