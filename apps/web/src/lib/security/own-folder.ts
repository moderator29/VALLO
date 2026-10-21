/**
 * Whether a storage path sits inside its owner's folder (`<owner>/...`).
 *
 * A prefix test alone is not a folder test: `<owner>/../<someone else>/x`
 * starts with `<owner>/` and walks out of it, and a storage key resolver or a
 * public URL builder may normalise it into the other person's folder. Storage
 * policies confine the WRITE to the caller's folder; this is the second check
 * that keeps a forged path from being RECORDED on a row as theirs (an avatar, a
 * cover photo, a host document, a chat photo under its conversation).
 *
 * Refused: an empty or over-long path, a backslash, a control character (a URL
 * parser strips tab and newline and would join segments), a path with no file
 * under the folder, and any empty, `.` or `..` segment. The owner's folder is
 * compared without case, because ids are UUIDs written in either case.
 */
export function pathInOwnFolder(owner: string, storagePath: string): boolean {
  if (typeof owner !== "string" || typeof storagePath !== "string") return false;
  if (owner.length === 0 || storagePath.length === 0 || storagePath.length > 400) return false;
  if (/[\\\u0000-\u001f\u007f]/.test(storagePath)) return false;
  const segments = storagePath.split("/");
  if (segments.length < 2) return false;
  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) return false;
  return segments[0]!.toLowerCase() === owner.toLowerCase();
}
