/**
 * TAKE ME THERE: THE DESTINATION SYNTAX (16 November 2026).
 *
 * An answer ends by offering the places the person can go. The model names
 * one with a marker and nothing else:
 *
 *     [[go:/admin/listings|Open the Listings desk]]
 *
 * The renderer turns a marker into a button, and ONLY when that address came
 * back from a tool in the same turn. A tool's links are filtered against the
 * viewer's own access on the server before the model ever sees them
 * (`tools/links.ts`), so a desk the person cannot open is never on the list
 * the renderer will honour. Anything else the model writes in the marker is
 * drawn as its plain words: no link, no button, nothing to press and nothing
 * that looks pressable. That is the whole rule, in one pure function, shared
 * by the renderer and its tests.
 *
 * Client-safe: no imports, no server reads, no words of copy.
 */

/** One place to go: what the button says and the console page it opens. */
export type Destination = { label: string; href: string };

/** A console path and nothing else: no scheme, no host, no `..`, no `//`. */
export function isConsolePath(value: string): boolean {
  if (value.length > 300 || value.includes("..") || value.includes("//")) return false;
  return /^\/admin([/?#][A-Za-z0-9_./?=&#%-]*)?$/.test(value);
}

/** The marker, written exactly: `[[go:<console path>|<label>]]`. */
const MARKER = /\[\[go:([^|\]\n]{1,300})\|([^\]\n]{1,90})\]\]/g;

/** The opening of a marker still being written, so half a marker is never shown. */
const PARTIAL = /\[\[(?:g(?:o(?::[^\]\n]{0,300})?)?)?$/;

/** How the model is told to write one, stated once and used in the house rules. */
export const DESTINATION_SYNTAX = "[[go:/admin/listings|Open the Listings desk]]";

/** At most this many buttons under one answer: more is a wall, not an offer. */
export const MAX_DESTINATIONS = 5;

const MAX_LABEL = 48;

function tidyLabel(raw: string): string {
  const flat = raw.replace(/\s+/g, " ").trim();
  return flat.length > MAX_LABEL ? `${flat.slice(0, MAX_LABEL - 1)}...` : flat;
}

/**
 * Split an answer into its prose and the destinations it may offer.
 *
 * `allowed` is the list of addresses the tools returned this turn. A marker
 * whose address is on that list becomes a destination and leaves the prose. A
 * marker the model invented leaves its label behind as plain text.
 */
export function splitDestinations(
  text: string,
  allowed: readonly Destination[] = [],
): { prose: string; destinations: Destination[] } {
  const byHref = new Map<string, string>();
  for (const link of allowed) {
    if (isConsolePath(link.href) && !byHref.has(link.href)) byHref.set(link.href, tidyLabel(link.label));
  }
  const destinations: Destination[] = [];
  const taken = new Set<string>();
  const prose = text.replace(MARKER, (_whole, rawHref: string, rawLabel: string) => {
    const href = rawHref.trim();
    const label = tidyLabel(rawLabel);
    if (!byHref.has(href)) return label;
    if (!taken.has(href) && destinations.length < MAX_DESTINATIONS) {
      taken.add(href);
      /* The label the tool wrote wins over the model's, so a button never
         promises something the desk does not do. */
      destinations.push({ href, label: byHref.get(href) || label });
    }
    return "";
  });
  return { prose: tidyProse(prose), destinations };
}

/** Drop a marker still being written, and the blank lines the removed ones left. */
function tidyProse(text: string): string {
  return text
    .replace(PARTIAL, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+$/, "");
}
