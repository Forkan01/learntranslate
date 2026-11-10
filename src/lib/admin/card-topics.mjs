import { validDraftId } from "./edit-draft.mjs";

const STATUSES = new Set(["draft", "review", "published", "rejected"]);
const CATEGORY_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const record = value => value !== null && typeof value === "object" && !Array.isArray(value);

export function parseTopicChange(raw) {
  if (!record(raw) || Object.keys(raw).length !== 1 ||
      !Object.hasOwn(raw, "categoryId") || !validDraftId(raw.categoryId))
    return null;
  return { categoryId: raw.categoryId };
}

function origin(base) {
  const url = new URL(base);
  if (url.protocol !== "https:" || url.username || url.password ||
      url.search || url.hash || url.pathname !== "/") throw new Error("Invalid DB URL");
  return url;
}
function endpoint(base, table) {
  return new URL("/rest/v1/" + table, origin(base));
}
export function topicCardUrl(base, cardId) {
  if (!validDraftId(cardId)) throw new Error("Invalid card id");
  const url = endpoint(base,"cards");
  url.searchParams.set("select","id,term,status");
  url.searchParams.set("id","eq."+cardId);
  url.searchParams.set("limit","1");
  return url;
}
export function topicCategoriesUrl(base) {
  const url=endpoint(base,"categories");
  url.searchParams.set("select","id,slug,name,description,icon,sort_order");
  url.searchParams.set("order","sort_order.asc,slug.asc");
  url.searchParams.set("limit","101");
  return url;
}
export function topicLinksUrl(base, cardId) {
  if (!validDraftId(cardId)) throw new Error("Invalid card id");
  const url=endpoint(base,"card_categories");
  url.searchParams.set("select","card_id,category_id,sort_order");
  url.searchParams.set("card_id","eq."+cardId);
  url.searchParams.set("limit","101");
  return url;
}
export function topicInsertUrl(base) {
  const url=endpoint(base,"card_categories");
  url.searchParams.set("select","card_id,category_id");
  return url;
}
export function topicWriteUrl(base, cardId, categoryId) {
  if (!validDraftId(cardId) || !validDraftId(categoryId))
    throw new Error("Invalid relationship");
  const url=endpoint(base,"card_categories");
  url.searchParams.set("select","card_id,category_id");
  url.searchParams.set("card_id","eq."+cardId);
  url.searchParams.set("category_id","eq."+categoryId);
  return url;
}
export function parseTopicSnapshot(cardRows, categories, links, cardId) {
  if (!Array.isArray(cardRows) || !Array.isArray(categories) || !Array.isArray(links) ||
      cardRows.length > 1 || categories.length > 100 || links.length > 100)
    throw new Error("Invalid topic data");
  if (!cardRows.length) return null;
  const card=cardRows[0];
  if (!record(card) || card.id !== cardId || !validDraftId(card.id) ||
      !STATUSES.has(card.status) || typeof card.term !== "string" ||
      card.term.length > 500 || !card.term.trim())
    throw new Error("Invalid card");
  const ids=new Set();
  const parsedCategories=categories.map(c=>{
    if (!record(c) || !validDraftId(c.id) || ids.has(c.id) ||
        typeof c.slug !== "string" || !CATEGORY_SLUG.test(c.slug) ||
        typeof c.name !== "string" || !c.name.trim() || c.name.length > 100 ||
        !Number.isInteger(c.sort_order) ||
        (c.description !== null && c.description !== undefined &&
         (typeof c.description !== "string" || c.description.length > 1000)) ||
        (c.icon !== null && c.icon !== undefined &&
         (typeof c.icon !== "string" || c.icon.length > 100)))
      throw new Error("Invalid category");
    ids.add(c.id);
    return {id:c.id,slug:c.slug,name:c.name,
      description:c.description??null,icon:c.icon??null};
  });
  const assigned=new Set();
  for (const link of links) {
    if (!record(link) || link.card_id !== cardId ||
        !validDraftId(link.category_id) || !ids.has(link.category_id) ||
        assigned.has(link.category_id) || !Number.isInteger(link.sort_order))
      throw new Error("Invalid category association");
    assigned.add(link.category_id);
  }
  return {card:{id:card.id,term:card.term,status:card.status},
    categories:parsedCategories, assignedIds:[...assigned]};
}
export function confirmTopicChange(raw,cardId,categoryId) {
  if (!Array.isArray(raw) || raw.length !== 1 || !record(raw[0]) ||
      raw[0].card_id !== cardId || raw[0].category_id !== categoryId)
    return false;
  return true;
}
