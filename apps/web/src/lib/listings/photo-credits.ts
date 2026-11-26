import "server-only";

import { cache } from "react";
import { reportReadError } from "@/lib/observability/read-error";
import { isSupabaseConfigured } from "../supabase/env";
import { createClient } from "../supabase/server";

/**
 * WHO TOOK THE PHOTOGRAPHS ON A PAGE.
 *
 * The example collection is illustrated with photographs hotlinked from
 * Unsplash, whose terms are explicit about two things: the image is served
 * from their CDN rather than copied onto our server, and the photographer is
 * credited where the photograph is shown. The first is true by construction
 * (the row stores an `images.unsplash.com` URL and `photoUrl` passes it
 * through untouched). The second is this file.
 *
 * `public.photo_credits` is reference data keyed by the same value the photo
 * rows carry, because one photograph is used by several listings and the
 * credit belongs to the photograph rather than to the row that borrowed it. A
 * lister's own photograph has no row here and needs none, so an empty result
 * is the normal case and draws nothing.
 *
 * READ AS A STRANGER READS. The anon client, against a world-readable table,
 * for the reason `lib/share/queries.ts` sets out at length: a read that only
 * worked with the service key would be a page rendering under a permission its
 * reader does not have.
 *
 * `photo_credits` is not in the generated `database.types.ts` yet, so the
 * query goes through a narrow local cast rather than dragging a schema
 * regeneration into this change. Same reasoning, same shape, as the door read.
 */

export type PhotoCredit = {
  /** The photographer's name, as Unsplash gives it. */
  photographer: string;
  /** Their profile, for the link the terms ask for. */
  photographerUrl: string | null;
  /** The photograph's own page. */
  photoUrl: string | null;
};

type CreditRow = {
  storage_path: string;
  photographer: string | null;
  photographer_url: string | null;
  photo_url: string | null;
};

type CreditQuery = (table: "photo_credits") => {
  select: (columns: string) => {
    in: (column: string, values: string[]) => PromiseLike<{ data: unknown; error: unknown }>;
  };
};

/**
 * The credits for these exact paths, keyed by path. Absent paths are absent
 * from the map rather than present and null, so a caller can only render a
 * credit it actually has.
 *
 * Deduplicated and capped: a page shows at most ten photographs, and one
 * `in (...)` of a handful of values is one round trip for the whole gallery
 * rather than one per picture.
 */
export const readPhotoCredits = cache(
  async (paths: readonly string[]): Promise<Map<string, PhotoCredit>> => {
    const wanted = [...new Set(paths.filter((p) => p.length > 0))].slice(0, 10);
    if (wanted.length === 0 || !isSupabaseConfigured()) return new Map();

    try {
      const supabase = await createClient();
      const { data, error } = await (supabase as unknown as { from: CreditQuery })
        .from("photo_credits")
        .select("storage_path, photographer, photographer_url, photo_url")
        .in("storage_path", wanted);

      await reportReadError("read.listing.photoCredits", error);
      if (error) return new Map();

      const rows = Array.isArray(data) ? (data as CreditRow[]) : [];
      const out = new Map<string, PhotoCredit>();
      for (const row of rows) {
        if (row.photographer === null || row.photographer.length === 0) continue;
        out.set(row.storage_path, {
          photographer: row.photographer,
          photographerUrl: row.photographer_url,
          photoUrl: row.photo_url,
        });
      }
      return out;
    } catch {
      /* A credit is a courtesy line under a gallery. It never takes a page
         down with it. */
      return new Map();
    }
  },
);

/**
 * The distinct photographers behind a gallery, in the order their first
 * photograph appears, so the line under a gallery reads in the same order the
 * reader scrolls.
 */
export function creditedPhotographers(
  paths: readonly string[],
  credits: Map<string, PhotoCredit>,
): PhotoCredit[] {
  const seen = new Set<string>();
  const out: PhotoCredit[] = [];
  for (const path of paths) {
    const credit = credits.get(path);
    if (credit === undefined || seen.has(credit.photographer)) continue;
    seen.add(credit.photographer);
    out.push(credit);
  }
  return out;
}
