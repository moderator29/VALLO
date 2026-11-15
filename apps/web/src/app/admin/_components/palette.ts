import { isIdentifier } from "@/lib/admin/lookup-classify";
import type { AdminIcon } from "./AdminGlyph";
import { ADMIN_NAV, canOpen, countFor, labelFor, type AdminDestination, type NavViewer, type ShellCopy } from "./nav";

/**
 * THE CONSOLE SEARCH'S RULES, pure and tested (reference 7067).
 *
 * The palette is one box over every desk. This file decides what it offers:
 * which desks match what was typed, in which order, and which searches are
 * offered under them. It reads the one desk map the rail and the phone drawer
 * already read (`nav.ts`), so the three can never disagree about what a desk
 * is called or where it lives, and it reads the same waiting counts the rail's
 * badges show. It invents no desk and no count.
 */

export type PaletteDesk = {
  key: string;
  href: string;
  label: string;
  /** What the desk is for, one line. Empty where nobody has written one. */
  lede: string;
  /** Work waiting on this desk right now, 0 when it carries no queue. */
  count: number;
  /** The `g` then letter shortcut that reaches it, if the console has one. */
  jump: string | null;
  icon: AdminIcon;
};

/**
 * Desks that exist and are not rows of the rail, so a person can still jump to
 * them by name. Empty today: reservations and restaurant fees became children
 * of Bookings (admin coverage, 13 October 2026), so every desk is on the map.
 * A desk added here must also be reachable from a page, never only from here.
 */
const EXTRA_DESKS: readonly AdminDestination[] = [];

export function deskIndex({
  shell,
  ledes,
  counts,
  jumps,
  viewer,
}: {
  shell?: ShellCopy;
  ledes: Readonly<Record<string, string | undefined>>;
  counts: Readonly<Record<string, number>>;
  /** Letter to href, from `CONSOLE_JUMPS`. */
  jumps: Readonly<Record<string, string>>;
  /**
   * Who is searching. The palette is a second way into every desk, so it is
   * filtered exactly as the rail is: a desk this person cannot open is not
   * offered here either, or Control K would hand a support agent the Staff
   * desk and the refusal that follows. Absent means draw everything, which is
   * what a preview and a test want.
   */
  viewer?: NavViewer;
}): PaletteDesk[] {
  const byHref = new Map<string, string>();
  for (const [letter, href] of Object.entries(jumps)) byHref.set(href, letter);
  return [...ADMIN_NAV, ...EXTRA_DESKS]
    .filter((item) => !viewer || canOpen(item, viewer))
    .map((item) => ({
      key: item.key,
      href: item.href,
      label: labelFor(item, shell),
      lede: ledes[item.key] ?? "",
      count: countFor(item, counts as Record<string, number>),
      jump: byHref.get(item.href) ?? null,
      icon: item.icon,
    }));
}

/** Lower case, accents folded, so "Verification" and "verification" meet. */
function fold(text: string): string {
  return text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * The desks for what was typed. Nothing typed: the desks with work waiting
 * lead, most first, then the rest in the rail's order, so the first thing the
 * box offers is where the work is. Something typed: a name that starts with it,
 * then a word that starts with it, then a name that contains it, then a line
 * that mentions it. Ties keep the rail's order.
 */
export function rankDesks(index: readonly PaletteDesk[], query: string, limit = 8): PaletteDesk[] {
  const q = fold(query.trim());
  if (q.length === 0) {
    const waiting = index.filter((d) => d.count > 0).sort((a, b) => b.count - a.count);
    const seen = new Set(waiting.map((d) => d.href + d.key));
    const rest = index.filter((d) => !seen.has(d.href + d.key));
    return [...waiting, ...rest].slice(0, limit);
  }
  const scored: { desk: PaletteDesk; score: number; at: number }[] = [];
  index.forEach((desk, at) => {
    const label = fold(desk.label);
    const lede = fold(desk.lede);
    let score = 0;
    if (label.startsWith(q)) score = 4;
    else if (label.split(/[\s/-]+/).some((word) => word.startsWith(q))) score = 3;
    else if (label.includes(q)) score = 2;
    else if (lede.includes(q)) score = 1;
    if (score > 0) scored.push({ desk, score, at });
  });
  /* The same address is one place: Moderation and Around open the same desk. */
  const seenHref = new Set<string>();
  return scored
    .sort((a, b) => b.score - a.score || a.at - b.at)
    .filter(({ desk }) => (seenHref.has(desk.href) ? false : (seenHref.add(desk.href), true)))
    .slice(0, limit)
    .map(({ desk }) => desk);
}

/** The desks a search box never searches on its own (the overview and charts). */
const NO_SEARCH = new Set(["operations", "analytics", "settings"]);

/**
 * Where a word searched "here" goes: the open desk's own `?q=`, or the unified
 * queue when the open page has no search of its own. This is exactly what the
 * bar's field has always done, lifted out so both share one answer.
 */
export function searchBase(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  return segments.length >= 2 && !NO_SEARCH.has(segments[1] ?? "") ? `/${segments[0]}/${segments[1]}` : "/admin/queue";
}

export type PaletteAction = {
  id: "lookup" | "desk" | "people" | "queue";
  href: string;
  label: string;
};

/**
 * The searches offered under the desks once something is typed. A pasted
 * reference leads with the lookup, which reads every desk the person may open;
 * a word offers the open desk's own search, then people, then the queue.
 */
export function paletteActions(
  query: string,
  pathname: string,
  words: {
    searchDesk: string;
    searchPeople: string;
    searchQueue: string;
    lookup: string;
  },
  deskName: string | null,
): PaletteAction[] {
  const q = query.trim();
  if (q.length === 0) return [];
  const enc = encodeURIComponent(q);
  const fill = (template: string, extra: Record<string, string> = {}) =>
    template.replace("{query}", q).replace(/\{(\w+)\}/g, (_, k: string) => extra[k] ?? `{${k}}`);
  const out: PaletteAction[] = [];
  if (isIdentifier(q)) out.push({ id: "lookup", href: `/admin/lookup?q=${enc}`, label: fill(words.lookup) });
  const base = searchBase(pathname);
  if (base !== "/admin/queue" && base !== "/admin/people" && deskName) {
    out.push({ id: "desk", href: `${base}?q=${enc}`, label: fill(words.searchDesk, { desk: deskName }) });
  }
  out.push({ id: "people", href: `/admin/people?q=${enc}`, label: fill(words.searchPeople) });
  out.push({ id: "queue", href: `/admin/queue?q=${enc}`, label: fill(words.searchQueue) });
  return out;
}
