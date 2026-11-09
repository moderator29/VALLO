"use client";

import { looksNative } from "./platform";

/**
 * STORE-04: THE NATIVE HALF OF SHARE, HAPTICS AND CAMERA CAPTURE.
 *
 * Each function asks `looksNative()` first and imports nothing on the web,
 * the same rule `boot.ts` sets: a visitor to the website pays for none of
 * this. In the shell the plugin is reached through `Capacitor.registerPlugin`
 * by name (`Share`, `Haptics`, `Camera`), which is how `components/app/push/
 * enrol.ts` reaches push, so the plugin packages are needed by `cap sync` and
 * never by the web bundle. A binary built without one of them rejects the
 * call, and every function here then answers "not handled" so the caller
 * falls back to what the website does.
 */

type Registry = { registerPlugin: <T>(name: string) => T; isPluginAvailable: (name: string) => boolean };

/* A Capacitor plugin is a Proxy that THROWS when anything reads `.then` on it
   ("Haptics.then() is not implemented on ios"). An async function that returns
   one hands it to the promise machinery, which reads `.then`, so the promise
   rejects and the caller never gets the plugin. It is therefore carried inside
   a plain object, and only ever read out of it after the await. */
type Held<T> = { readonly plugin: T };

async function plugin<T>(name: string): Promise<Held<T> | null> {
  if (!looksNative()) return null;
  try {
    const { Capacitor } = (await import("@capacitor/core")) as unknown as { Capacitor: Registry };
    if (!Capacitor.isPluginAvailable(name)) return null;
    return { plugin: Capacitor.registerPlugin<T>(name) };
  } catch {
    return null;
  }
}

type SharePlugin = {
  share: (options: { title?: string; text?: string; url?: string; dialogTitle?: string }) => Promise<unknown>;
};

/**
 * The system share sheet. `"shared"` or `"cancelled"` when the native sheet
 * handled it; `"unhandled"` on the website or a binary without the plugin,
 * where the caller uses `navigator.share` or the clipboard as before.
 */
export async function nativeShare(input: {
  title?: string;
  text?: string;
  url?: string;
}): Promise<"shared" | "cancelled" | "unhandled"> {
  const heldShare = await plugin<SharePlugin>("Share");
  if (!heldShare) return "unhandled";
  const share = heldShare.plugin;
  try {
    await share.share({ ...input, dialogTitle: "Share" });
    return "shared";
  } catch (error) {
    /* The plugin rejects with "Share canceled" when the person closes the
       sheet, which is an answer, not a failure. */
    const message = error instanceof Error ? error.message : String(error);
    return /cancel/i.test(message) ? "cancelled" : "unhandled";
  }
}

type CameraPlugin = {
  getPhoto: (options: {
    quality: number;
    resultType: "base64";
    source: "CAMERA";
    width: number;
    correctOrientation: boolean;
    saveToGallery: boolean;
  }) => Promise<{ base64String?: string; format?: string }>;
};

/** Whether the running shell can open its own camera. */
export async function canCapturePhoto(): Promise<boolean> {
  return (await plugin<CameraPlugin>("Camera")) !== null;
}

/**
 * Open the camera and hand back the photograph as a `File`, so it goes
 * through exactly the upload path a picked file does. Null when the person
 * cancelled or the shell has no camera plugin.
 *
 * Base64 rather than a file URI: with the app loaded from the live origin, a
 * `capacitor://localhost` file URL is cross-origin to the page and cannot be
 * read back.
 */
export async function capturePhoto(): Promise<File | null> {
  const heldCamera = await plugin<CameraPlugin>("Camera");
  if (!heldCamera) return null;
  const camera = heldCamera.plugin;
  try {
    const photo = await camera.getPhoto({
      quality: 85,
      resultType: "base64",
      source: "CAMERA",
      /* Listing photos must be at least MIN_PHOTO_WIDTH wide and are shown at
         most around 2,000 across; 2,400 keeps every detail and the upload
         small on a metered bundle. */
      width: 2400,
      correctOrientation: true,
      saveToGallery: false,
    });
    return photoFile(photo.base64String, photo.format);
  } catch {
    return null;
  }
}

/** Base64 from the camera plugin to a `File`. Exported for its test. */
export function photoFile(base64: string | undefined, format: string | undefined): File | null {
  if (!base64) return null;
  const extension = (format ?? "jpeg").toLowerCase() === "png" ? "png" : "jpeg";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new File([bytes], `camera-${Date.now()}.${extension === "png" ? "png" : "jpg"}`, {
    type: `image/${extension}`,
  });
}
