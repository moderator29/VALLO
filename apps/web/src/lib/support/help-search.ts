/**
 * Search and selection over the help centre's articles.
 *
 * Pure and dependency-free, so the in-app support home can run it on the
 * device against the list the server handed it, with no round trip per
 * keystroke. The articles themselves live in `help-articles.ts`.
 */

export type HelpArticle = {
  category: string;
  q: string;
  a: string;
  /**
   * Where the answer lives, when it is not a help answer that can be opened
   * in place. A Docs chapter, a Guide or a legal page is a page, so a row
   * that carries one is a door rather than a disclosure (14 November 2026,
   * the help centre pass).
   */
  href?: string;
};

/** Lower-case and fold accents, so "Yoruba" finds "Yorùbá". */
function fold(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Articles matching every word of the query, question matches first.
 *
 * Every word must appear somewhere in the question, the answer or the
 * category, so "refund card" narrows rather than widens. A hit in the
 * question outranks a hit only in the answer, because the question is what
 * the person is scanning for. An empty query matches nothing: the caller
 * shows its featured list instead of the whole library.
 */
export function searchHelpArticles<T extends HelpArticle>(articles: readonly T[], query: string, limit = 8): T[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const scored: { article: T; score: number; index: number }[] = [];
  articles.forEach((article, index) => {
    const q = fold(article.q);
    const haystack = `${q} ${fold(article.a)} ${fold(article.category)}`;
    if (!words.every((word) => haystack.includes(word))) return;
    const score = words.filter((word) => q.includes(word)).length;
    scored.push({ article, score, index });
  });
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  return scored.slice(0, Math.max(0, limit)).map((entry) => entry.article);
}

/** The featured articles, in the order given, skipping any that no longer exist. */
export function popularArticles<T extends HelpArticle>(articles: readonly T[], questions: readonly string[]): T[] {
  const byQuestion = new Map(articles.map((article) => [article.q, article]));
  return questions.flatMap((q) => {
    const article = byQuestion.get(q);
    return article ? [article] : [];
  });
}
