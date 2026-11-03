import { LOCKUP_PATH } from "./theme";

/**
 * EVERY PICTURE A RENDERED EMAIL MAY CARRY, SORTED (for the shell, message,
 * welcome and icon tests, so four files hold one rule).
 *
 *   lockup   the wordmark on its navy tile, first, alt the brand name
 *   object   at most one 3D object above the headline, alt its family
 *   glyphs   16px line glyphs in the rows, decorative, alt empty
 *   photos   a real photograph of a space on a space card, alt its name
 *   other    anything else, which is a picture nobody sanctioned
 *
 * It sorts by path, because the path is what says which tier a picture is.
 */
export type EmailImages = {
  lockup: string | null;
  object: string[];
  glyphs: string[];
  photos: string[];
  /** The wide banner under the lockup (`banners.ts`), alt its headline. */
  banner: string[];
  other: string[];
};

export function sortEmailImages(html: string): EmailImages {
  const images = html.match(/<img\b[^>]*>/g) ?? [];
  const out: EmailImages = { lockup: null, object: [], glyphs: [], photos: [], banner: [], other: [] };
  for (const image of images) {
    const src = /\bsrc="([^"]+)"/.exec(image)?.[1] ?? "";
    if (src.includes(LOCKUP_PATH) && out.lockup === null) out.lockup = image;
    else if (src.includes("/brand/3d/email/")) out.object.push(image);
    else if (src.includes("/brand/email/glyphs/")) out.glyphs.push(image);
    else if (src.includes("/brand/email/banners/")) out.banner.push(image);
    else if (/\bdata-space-photo\b/.test(image)) out.photos.push(image);
    else out.other.push(image);
  }
  return out;
}
