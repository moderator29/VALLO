import { countOf } from "@vallo/i18n/core";
import type { IntelligenceResult, Understood } from "../contract";

/**
 * Small words shared by the sources: a naira figure as people say it, and the
 * "why this matched" line, built ONLY from filters the row actually meets.
 */

/** "₦5m", "₦450k", "₦1.25m": the short naira people type. Whole naira in. */
export function nairaShort(naira: number): string {
  if (naira >= 1_000_000) return `₦${Number((naira / 1_000_000).toFixed(2))}m`;
  if (naira >= 1_000) return `₦${Math.round(naira / 1_000)}k`;
  return `₦${naira}`;
}

/** Kobo to whole naira, never a fraction. */
export function nairaOf(minor: number): number {
  return Math.round(minor / 100);
}

/**
 * The "2 bedrooms · Lekki · under ₦5m" line. Each part is written only when
 * the row's own facts satisfy that filter, so the line never claims a match
 * the row does not have.
 */
export function whyLine(
  u: Understood,
  facts: { bedrooms?: number; area?: string; city?: string; priceNaira?: number; furnished?: boolean; amenities?: string[] },
): string | undefined {
  const parts: string[] = [];
  if (u.bedrooms !== undefined && facts.bedrooms !== undefined && facts.bedrooms >= u.bedrooms) {
    parts.push(countOf(facts.bedrooms, "bedrooms"));
  }
  if (u.place) {
    const name = u.place.split(",")[0]!.trim().toLowerCase();
    const where = [facts.area, facts.city].filter(Boolean).join(" ").toLowerCase();
    if (where.includes(name)) parts.push(u.place.split(",")[0]!.trim());
  }
  if (u.maxPrice !== undefined && facts.priceNaira !== undefined && facts.priceNaira > 0 && facts.priceNaira <= u.maxPrice) {
    parts.push(`under ${nairaShort(u.maxPrice)}`);
  }
  if (u.minPrice !== undefined && facts.priceNaira !== undefined && facts.priceNaira >= u.minPrice) {
    parts.push(`over ${nairaShort(u.minPrice)}`);
  }
  if (u.furnished === true && facts.furnished === true) parts.push("furnished");
  if (u.furnished === false && facts.furnished === false) parts.push("unfurnished");
  for (const a of u.amenities ?? []) {
    if (facts.amenities?.includes(a)) parts.push(a === "pool" ? "pool" : a === "ac" ? "air conditioning" : a);
  }
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

/** Drop the keys whose value is undefined, so a result carries only real fields. */
export function compact(result: IntelligenceResult): IntelligenceResult {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(result)) if (v !== undefined) out[k] = v;
  return out as unknown as IntelligenceResult;
}

/** Every word of the text appears in the haystack (as a whole word or a word start). */
export function matchesAllWords(text: string | undefined, haystack: string): boolean {
  if (!text) return true;
  const hay = ` ${haystack.toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => hay.includes(` ${w.replace(/[^a-z0-9]/g, "")}`));
}

/** Safe inside a PostgREST `or` and an `ilike`: no commas, brackets, dots or wildcards. */
export function safePattern(raw: string): string {
  return raw.replace(/[%_,()\\.:*"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 40);
}
