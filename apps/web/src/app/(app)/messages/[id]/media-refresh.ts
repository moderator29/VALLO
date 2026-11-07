/**
 * FRESH LINKS, SWAPPED IN PLACE (Platform Grade 1, P1.3 follow-up). Pure.
 *
 * `readThreadMedia` answers with a new signed link per message; this puts each
 * on its bubble. A link made on this device (`blob:`, a photo or a note still
 * sending or waiting) is never replaced, and a bubble with no photo or note
 * gains nothing it did not have.
 */

type Fresh =
  | { kind: "image"; url: string }
  | { kind: "audio"; url: string };

type MediaBubble = {
  id: string;
  imageUrl: string | null;
  audio?: { url: string; durationMs?: number | null; peaks?: number[] | null };
};

export function withFreshMedia<T extends MediaBubble>(items: T[], fresh: Record<string, Fresh>): T[] {
  let changed = false;
  const out = items.map((m) => {
    const found = fresh[m.id];
    if (!found) return m;
    if (found.kind === "audio") {
      if (!m.audio || m.audio.url.startsWith("blob:") || m.audio.url === found.url) return m;
      changed = true;
      return { ...m, audio: { ...m.audio, url: found.url } };
    }
    if (!m.imageUrl || m.imageUrl.startsWith("blob:") || m.imageUrl === found.url) return m;
    changed = true;
    return { ...m, imageUrl: found.url };
  });
  return changed ? out : items;
}
