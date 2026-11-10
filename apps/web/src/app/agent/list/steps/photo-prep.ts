/**
 * THE PHOTO'S PREPARATION ON THE PHONE, before a byte leaves it: its size
 * (the 1600px gate reads the long edge) and its re-encode, which strips every
 * piece of metadata, GPS above all. Moved out of `ListingWizard.tsx`
 * unchanged when the wizard was split into steps (P1.1); the upload, the
 * attach and the retries stay in the wizard.
 */

/**
 * The photo's pixel size, or null when this browser cannot decode it (HEIC
 * outside Safari). The gate reads the long edge; see `lib/listings/photo-gate`.
 */
export async function sizeOf(file: File): Promise<{ width: number; height: number } | null> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      const size = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return size;
    } catch {
      /* fall through to the image element */
    }
  }
  return await new Promise<{ width: number; height: number } | null>((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    image.src = url;
  });
}

/**
 * Re-encode a photo before it leaves the phone.
 *
 * A camera photo carries EXIF, and on a phone that usually includes GPS
 * coordinates. Listing photos are served from a public bucket, so uploading
 * the original file would publish the exact location of the property to
 * anyone who downloads the image, which is precisely what the platform
 * promises not to do before an inspection. Drawing the image onto a canvas
 * and exporting it produces pixels with no metadata at all, so the tag
 * cannot survive.
 *
 * The long edge is capped at 2560px, comfortably above the 1600px minimum
 * the quality gate demands, which also cuts the upload down for someone on
 * a slow connection. If anything about the re-encode fails the original file
 * is refused rather than uploaded, because publishing a geotagged photo is
 * worse than asking for another one.
 */
export async function stripMetadata(file: File): Promise<{ blob: Blob; contentType: string; extension: string } | null> {
  const MAX_EDGE = 2560;
  /*
   * The decoded image, by either door. `createImageBitmap` is missing or
   * refuses some files on older Android WebViews and in Safari for HEIC,
   * where an <img> element still decodes them; without this second door a
   * photo that measured fine was refused at the re-encode.
   */
  const decoded = await (async (): Promise<{ source: CanvasImageSource; width: number; height: number; done: () => void } | null> => {
    if (typeof createImageBitmap === "function") {
      try {
        const bitmap = await createImageBitmap(file);
        return { source: bitmap, width: bitmap.width, height: bitmap.height, done: () => bitmap.close() };
      } catch {
        /* try the image element */
      }
    }
    return await new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () =>
        resolve({ source: image, width: image.naturalWidth, height: image.naturalHeight, done: () => URL.revokeObjectURL(url) });
      image.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      image.src = url;
    });
  })();
  if (!decoded || decoded.width <= 0 || decoded.height <= 0) {
    decoded?.done();
    return null;
  }
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(decoded.width, decoded.height));
    const width = Math.round(decoded.width * scale);
    const height = Math.round(decoded.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.imageSmoothingQuality = "high";
    context.drawImage(decoded.source, 0, 0, width, height);

    const useWebp = (() => {
      try { const c = document.createElement("canvas"); c.width = 1; c.height = 1; return c.toDataURL("image/webp").startsWith("data:image/webp"); } catch { return false; }
    })();
    const mime = useWebp ? "image/webp" : "image/jpeg";
    const ext = useWebp ? "webp" : "jpg";
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), mime, 0.88);
    });
    return blob ? { blob, contentType: mime, extension: ext } : null;
  } catch {
    return null;
  } finally {
    decoded.done();
  }
}
