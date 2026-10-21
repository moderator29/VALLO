/**
 * SAVE AND SHARE FOR A PHOTO OR VIDEO IN A CHAT (`MediaViewer`).
 *
 * A signed URL points at another origin, where the `download` attribute of a
 * link is ignored, so the file is fetched first and saved from a blob URL.
 * Share uses the Web Share API with the file itself when the browser can share
 * files, and says it cannot otherwise (`canShareMedia`), so the viewer draws no
 * Share control that would do nothing. Nothing here claims more than the
 * browser answered: a refused fetch is `"failed"`, and the caller says so.
 */

const EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/avif": "avif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/3gpp": "3gp",
};

/** A readable file name: the app's name for it, the id, and the type's extension when it is known. */
export function mediaFileName(input: { kind: "photo" | "video"; id: string; src: string }, mime?: string | null): string {
  const type = bareType(mime);
  let ext = EXTENSION[type];
  if (!ext) {
    const path = input.src.split("?")[0] ?? "";
    const found = /\.([a-z0-9]{2,5})$/i.exec(path)?.[1]?.toLowerCase();
    ext = found ?? (input.kind === "video" ? "mp4" : "jpg");
  }
  const safeId = input.id.replace(/[^a-z0-9-]/gi, "").slice(0, 36) || "file";
  return `vallo-${input.kind}-${safeId}.${ext}`;
}

/** `image/svg+xml;charset=utf-8` reads as `image/svg+xml`; an empty type stays empty. */
export function bareType(mime: string | null | undefined): string {
  return (mime ?? "").split(";")[0]!.trim().toLowerCase();
}

export function canShareMedia(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

async function fetchBlob(src: string): Promise<Blob> {
  const response = await fetch(src);
  if (!response.ok) throw new Error(`media ${response.status}`);
  return response.blob();
}

/** Saves the file: from a blob URL, or, when the file cannot be read here, by opening it. */
export async function saveMedia(input: { kind: "photo" | "video"; id: string; src: string }): Promise<"saved" | "opened" | "failed"> {
  try {
    const blob = await fetchBlob(input.src);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = mediaFileName(input, blob.type);
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    return "saved";
  } catch {
    /* A host that does not allow the read: the file still opens in its own
       tab, where the browser's own save is one tap away. */
    try {
      const opened = window.open(input.src, "_blank", "noopener,noreferrer");
      return opened ? "opened" : "failed";
    } catch {
      return "failed";
    }
  }
}

/** Shares the file itself through the system share sheet. A dismissed sheet is `"cancelled"`, not an error. */
export async function shareMedia(
  input: { kind: "photo" | "video"; id: string; src: string },
  title: string,
): Promise<"shared" | "cancelled" | "failed"> {
  try {
    const blob = await fetchBlob(input.src);
    /* The bare media type: a server may add parameters (`;charset=utf-8`),
       and the share sheet matches types against its own list of shareable
       ones, where a parameter can make a good photo unshareable. */
    const type = bareType(blob.type);
    const file = new File([blob], mediaFileName(input, type), { type });
    const data: ShareData = { files: [file], title };
    if (typeof navigator.canShare === "function" && !navigator.canShare(data)) return "failed";
    await navigator.share(data);
    return "shared";
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    return "failed";
  }
}
