import { NextResponse } from "next/server";

function databaseConfig() {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) throw new Error("Missing database config");
  const origin = new URL(base);
  if (origin.protocol !== "https:" || origin.username || origin.password) throw new Error("Invalid database origin");
  return { origin, key };
}
async function rows(origin: URL, key: string, table: string, params: Record<string,string>): Promise<Record<string,unknown>[]> {
  const url = new URL("/rest/v1/" + table, origin);
  Object.entries(params).forEach(([k,v]) => url.searchParams.set(k,v));
  const response = await fetch(url, { headers: { apikey:key, Authorization:"Bearer " + key },
    cache:"no-store", signal:AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("Database query failed");
  const value: unknown = await response.json();
  if (!Array.isArray(value)) throw new Error("Invalid database response");
  return value as Record<string,unknown>[];
}
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug");
  if (slug !== null && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return NextResponse.json({ error:"Invalid category" }, { status:400 });
  }
  try {
    const { origin, key } = databaseConfig();
    const categories = await rows(origin,key,"categories", {
      select:"id,slug,name,description,icon,sort_order", order:"sort_order.asc", limit:"100"
    });
    if (!slug) return NextResponse.json({ categories }, { headers:{"Cache-Control":"no-store"} });
    const category = categories.find(x => x.slug === slug);
    if (!category || typeof category.id !== "string") {
      return NextResponse.json({ error:"Category not found" }, { status:404 });
    }
    const links = await rows(origin,key,"card_categories", {
      select:"card_id,sort_order", category_id:"eq." + category.id, order:"sort_order.asc", limit:"100"
    });
    const ids = links.map(x => x.card_id).filter((x):x is string => typeof x === "string" && /^[a-f0-9-]{36}$/i.test(x));
    if (!ids.length) return NextResponse.json({ category, cards:[] });
    const cards = await rows(origin,key,"cards", {
      select:"id,term,type,content,status", id:"in.(" + ids.join(",") + ")",
      status:"eq.published", limit:"100"
    });
    const byId = new Map(cards.filter(c => c.status === "published").map(c => [c.id,c]));
    return NextResponse.json({ category, cards:ids.map(id => byId.get(id)).filter(Boolean) }, {
      headers:{"Cache-Control":"no-store"}
    });
  } catch {
    return NextResponse.json({ error:"Categories unavailable" }, { status:503 });
  }
}
