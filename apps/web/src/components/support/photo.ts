"use client";

import { reencodeToJpeg } from "@/components/social/profile/reencode";
import { loadBrowserClient } from "@/lib/supabase/load-client";
import { attachToMyTicket } from "@/lib/support/ticket-reply";
import { uploadToStorage } from "@/lib/media/upload";

/**
 * A screenshot or photo on its way to a support ticket.
 *
 * The original file is never uploaded. A phone photo carries EXIF, often GPS,
 * and a screenshot can be larger than the bucket allows; re-encoding through
 * a canvas keeps only the pixels and caps the long edge, the same rule the
 * message thread applies to its photos. A file the browser cannot decode
 * (HEIC outside Safari) is refused in words rather than sent as the original.
 */
export type PreparedPhoto = { blob: Blob; width: number; height: number; previewUrl: string };

export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif";

export async function preparePhoto(file: File): Promise<PreparedPhoto | { error: string }> {
  if (!file.type.startsWith("image/")) return { error: "Choose a photo or a screenshot." };
  const blob = await reencodeToJpeg(file, { maxEdge: 2560, quality: 0.85 });
  if (!blob) return { error: "That photo could not be read on this device. Try a screenshot or a JPEG." };
  if (blob.size > 10 * 1024 * 1024) return { error: "That photo is too large. Try a smaller one." };
  const previewUrl = URL.createObjectURL(blob);
  const { width, height } = await new Promise<{ width: number; height: number }>((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = previewUrl;
  });
  return { blob, width, height, previewUrl };
}

/**
 * Upload into the member's own folder for this ticket, then record it.
 *
 * The path is `<member id>/<ticket id>/<random>.jpg`; the storage policy and
 * the attachments insert policy both refuse any other shape, and a ticket
 * that is not the member's or is no longer open.
 */
export async function uploadTicketPhoto(
  ticketId: string,
  photo: PreparedPhoto,
  messageId?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const failed = "The photo could not be attached just now. Add it again from the conversation.";
  try {
    const supabase = await loadBrowserClient();
    if (!supabase) return { ok: false, error: failed };
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) return { ok: false, error: "Sign in again to attach a photo." };
    const path = `${userId}/${ticketId}/${crypto.randomUUID()}.jpg`;
    const uploaded = await uploadToStorage({ supabase, bucket: "support-attachments", path, body: photo.blob, contentType: "image/jpeg" });
    if (!uploaded.ok) return { ok: false, error: failed };
    const result = await attachToMyTicket({
      ticketId,
      messageId,
      storagePath: path,
      mimeType: "image/jpeg",
      sizeBytes: photo.blob.size,
      width: photo.width > 0 ? photo.width : undefined,
      height: photo.height > 0 ? photo.height : undefined,
    });
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  } catch {
    return { ok: false, error: failed };
  }
}
