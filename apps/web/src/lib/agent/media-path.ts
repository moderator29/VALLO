/**
 * WHERE A LISTING'S UPLOADED MEDIA MAY SIT: `<auth uid>/<listing id>/<file>`,
 * the only shape the wizard writes, in both the photo and the video bucket.
 *
 * `addPhoto` and `addVideo` record a row that makes an object public (or
 * playable) under a listing's name, so the path is checked here whoever calls
 * and whatever the schema already refused: a bounded length, no backslash or
 * control character, exactly three segments, the caller's own uid, this
 * listing's id, and a file name that is a real name, never "." or "..". The
 * uid prefix alone accepted `<uid>/../<someone>/x`, and a path from another of
 * the caller's listings, which the refusal clean-up (it only touches this
 * listing's folder) could then never remove.
 *
 * Kept out of the "use server" module because there every export is a public
 * endpoint.
 */
export function inListingFolder(path: string, userId: string, listingId: string): boolean {
  if (typeof path !== "string" || path.length < 6 || path.length > 400) return false;
  if (/[\\\u0000-\u001f\u007f]/.test(path)) return false;
  const parts = path.split("/");
  if (parts.length !== 3) return false;
  const [owner, folder, file] = parts as [string, string, string];
  if (!userId || !listingId) return false;
  return owner === userId && folder === listingId && file.length > 0 && file !== "." && file !== "..";
}
