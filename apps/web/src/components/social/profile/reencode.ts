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
 * The same technique is already used by `stripMetadata` in the listing wizard
 * and by `downscaleToSquare` on the account profile. This is a third caller
 * rather than a third rule, and the three should be hoisted into one shared
 * module the next time anybody is in all of them.
 */

export type ReencodeOptions = {
  /** Longest edge of the result, in pixels. */
  maxEdge: number;
  /** Centre crop to a square first, for an avatar. */
  square?: boolean;
  /** JPEG quality, 0 to 1. */
  quality?: number;
};

export async function reencodeToJpeg(
  file: File,
  { maxEdge, square = false, quality = 0.92 }: ReencodeOptions,
): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file);
    try {
      const sourceW = bitmap.width;
      const sourceH = bitmap.height;
      if (sourceW === 0 || sourceH === 0) return null;

      /* A square avatar takes the middle of the frame, which is where a face
         almost always is. A cover keeps its own shape. */
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

      return await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
      });
    } finally {
      bitmap.close();
    }
  } catch {
    return null;
  }
}
