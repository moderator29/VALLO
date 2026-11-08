/**
 * Re-encode a chosen photo before it ever leaves the phone.
 *
 * A camera photo carries EXIF, and on a phone that usually includes GPS. A
 * cover and an avatar both serve from PUBLIC buckets, so uploading the original
 * file would publish the coordinates of wherever it was taken to anyone who
 * downloads the image. For a photo of your own street that is your address.
 *
 * Drawing the image onto a canvas and exporting it produces pixels with no
 * metadata at all, so the tag cannot survive. If anything about the re-encode
 * fails this returns null and the caller REFUSES rather than falling back to
 * the original file: publishing a geotagged photo is worse than asking somebody
 * for another one.
 *
 * Output is WebP when the browser supports it (every modern browser does),
 * falling back to JPEG for the rare engine that does not. Callers receive
 * the content type alongside the blob so they can set the storage path and
 * content-type header correctly.
 */

export type ReencodeOptions = {
  /** Longest edge of the result, in pixels. */
  maxEdge: number;
  /** Centre crop to a square first, for an avatar. */
  square?: boolean;
  /** Quality, 0 to 1. Applied to both WebP and JPEG. */
  quality?: number;
};

export type ReencodeResult = {
  blob: Blob;
  contentType: "image/webp" | "image/jpeg";
  extension: "webp" | "jpg";
};

let _webpSupported: boolean | null = null;

function supportsWebp(): boolean {
  if (_webpSupported !== null) return _webpSupported;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    _webpSupported = canvas.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    _webpSupported = false;
  }
  return _webpSupported;
}

export async function reencodePhoto(
  file: File,
  { maxEdge, square = false, quality = 0.88 }: ReencodeOptions,
): Promise<ReencodeResult | null> {
  try {
    const bitmap = await createImageBitmap(file);
    try {
      const sourceW = bitmap.width;
      const sourceH = bitmap.height;
      if (sourceW === 0 || sourceH === 0) return null;

      const cropSize = square ? Math.min(sourceW, sourceH) : 0;
      const sx = square ? (sourceW - cropSize) / 2 : 0;
      const sy = square ? (sourceH - cropSize) / 2 : 0;
      const sw = square ? cropSize : sourceW;
      const sh = square ? cropSize : sourceH;

      const scale = Math.min(1, maxEdge / Math.max(sw, sh));
      const width = Math.max(1, Math.round(sw * scale));
      const height = Math.max(1, Math.round(sh * scale));

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) return null;
      context.imageSmoothingQuality = "high";
      context.drawImage(bitmap, sx, sy, sw, sh, 0, 0, width, height);

      const useWebp = supportsWebp();
      const mime = useWebp ? "image/webp" : "image/jpeg";
      const ext = useWebp ? "webp" : "jpg";

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), mime, quality);
      });
      if (!blob) return null;
      return { blob, contentType: mime, extension: ext };
    } finally {
      bitmap.close();
    }
  } catch {
    return null;
  }
}

/** @deprecated Use `reencodePhoto` instead. Kept for any remaining callers. */
export async function reencodeToJpeg(
  file: File,
  opts: ReencodeOptions,
): Promise<Blob | null> {
  const result = await reencodePhoto(file, opts);
  return result?.blob ?? null;
}
