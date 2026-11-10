import "server-only";
import { validDraftId } from "./edit-draft.mjs";
import {
  parseTopicSnapshot, topicCardUrl, topicCategoriesUrl, topicLinksUrl,
  topicInsertUrl, topicWriteUrl, confirmTopicChange,
  type TopicSnapshot,
} from "./card-topics.mjs";

export class CardTopicsUnavailable extends Error {}
export class CardTopicsConflict extends Error {}
export class CardTopicsInvalid extends Error {}

function config() {
  const base=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key || key.length>4096) throw new CardTopicsUnavailable();
  return {base,key};
}
const headers=(key:string)=>({apikey:key,Authorization:"Bearer "+key});

async function getRows(url:URL,key:string): Promise<unknown> {
  const result=await fetch(url,{
    headers:headers(key),cache:"no-store",signal:AbortSignal.timeout(8000),
  });
  if (!result.ok) throw new Error("Database read rejected");
  return result.json();
}

/** Read is separately gated and must be called only AFTER admin authentication. */
export async function loadCardTopics(cardId:string):Promise<TopicSnapshot | null> {
  if (process.env.ENABLE_LEARNTRANSLATE_ADMIN_REVIEW_READ !== "true")
    throw new CardTopicsUnavailable();
  if (!validDraftId(cardId)) return null;
  const {base,key}=config();
  try {
    const [card,categories,links]=await Promise.all([
      getRows(topicCardUrl(base,cardId),key),
      getRows(topicCategoriesUrl(base),key),
      getRows(topicLinksUrl(base,cardId),key),
    ]);
    return parseTopicSnapshot(card,categories,links,cardId);
  } catch {
    throw new CardTopicsUnavailable();
  }
}

/** Mutations change only ONE relationship row; never cards, status or categories. */
export async function changeCardTopic(
  cardId:string,categoryId:string,action:"add"|"remove"
):Promise<{kind:"changed";assigned:boolean} | {kind:"conflict"} | null> {
  if (process.env.ENABLE_LEARNTRANSLATE_ADMIN_CATEGORY_WRITE !== "true")
    throw new CardTopicsUnavailable();
  if (!validDraftId(cardId) || !validDraftId(categoryId) ||
      (action !== "add" && action !== "remove")) throw new CardTopicsInvalid();
  const current=await loadCardTopics(cardId);
  if (!current) return null;
  if (!current.categories.some(category=>category.id===categoryId))
    throw new CardTopicsInvalid();
  const already=current.assignedIds.includes(categoryId);
  if ((action==="add" && already) || (action==="remove" && !already))
    return {kind:"conflict"};

  const {base,key}=config();
  let response:Response;
  try {
    response=await fetch(action==="add" ? topicInsertUrl(base) :
      topicWriteUrl(base,cardId,categoryId), {
      method:action==="add"?"POST":"DELETE",
      headers:{
        ...headers(key),"Content-Type":"application/json",
        Prefer:"return=representation",
      },
      ...(action==="add" ? {body:JSON.stringify({card_id:cardId,category_id:categoryId})} : {}),
      cache:"no-store",signal:AbortSignal.timeout(8000),
    });
  } catch {
    // The DB may already have applied the write. Always re-read before retrying.
    throw new CardTopicsUnavailable();
  }
  if (response.status===409) throw new CardTopicsConflict();
  if (!response.ok || (action==="add" && response.status!==201))
    throw new CardTopicsUnavailable();
  try {
    const result:unknown=await response.json();
    if (Array.isArray(result) && result.length===0) return {kind:"conflict"};
    if (!confirmTopicChange(result,cardId,categoryId))
      throw new Error("Unexpected relationship response");
    return {kind:"changed",assigned:action==="add"};
  } catch {
    throw new CardTopicsUnavailable();
  }
}
