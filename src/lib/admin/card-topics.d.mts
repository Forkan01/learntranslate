export type TopicCard = {
  id: string;
  term: string;
  status: "draft" | "review" | "published" | "rejected";
};
export type TopicCategory = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
};
export type TopicSnapshot = {
  card: TopicCard;
  categories: TopicCategory[];
  assignedIds: string[];
};
export function parseTopicChange(raw: unknown): {categoryId: string} | null;
export function topicCardUrl(base: string, cardId: string): URL;
export function topicCategoriesUrl(base: string): URL;
export function topicLinksUrl(base: string, cardId: string): URL;
export function topicWriteUrl(base: string, cardId: string, categoryId: string): URL;
export function parseTopicSnapshot(
  cardRows: unknown, categories: unknown, links: unknown, cardId: string
): TopicSnapshot | null;
export function confirmTopicChange(raw: unknown, cardId: string, categoryId: string): boolean;
