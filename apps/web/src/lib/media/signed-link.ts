/**
 * Which bucket and path a Supabase signed link names, for the buckets that
 * serve media to the app. Pure, so it is tested without a server
 * (`refresh-url.ts` is the action that uses it).
 */

const MEDIA_BUCKETS = new Set([
  "listing-videos",
  "show-me-clips",
  "social-media",
  "message-attachments",
]);

const SIGN_PATH = /^\/storage\/v1\/object\/sign\/([a-z0-9-]+)\/(.+)$/;

/** Bucket and path out of a Supabase signed link on this project's host, or null. */
export function parseSignedLink(link: string, projectUrl: string): { bucket: string; path: string } | null {
  let url: URL;
  let project: URL;
  try {
    url = new URL(link);
    project = new URL(projectUrl);
  } catch {
    return null;
  }
  if (url.host !== project.host || url.protocol !== "https:") return null;
  const match = SIGN_PATH.exec(url.pathname);
  if (!match) return null;
  const bucket = match[1]!;
  if (!MEDIA_BUCKETS.has(bucket)) return null;
  let path: string;
  try {
    path = decodeURIComponent(match[2]!);
  } catch {
    return null;
  }
  if (path.includes("..") || path.length > 512) return null;
  return { bucket, path };
}
