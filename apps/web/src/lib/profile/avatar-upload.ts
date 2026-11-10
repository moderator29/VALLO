import { AVATAR_MAX_EDGE } from "@/lib/profile/model";
import { setAvatar } from "@/lib/profile/actions";
import { COVER_MAX_BYTES } from "@/lib/social/profiles-model";
import { loadBrowserClient } from "@/lib/supabase/load-client";
import { reencodePhoto } from "@/components/social/profile/reencode";
import { uploadToStorage } from "@/lib/media/upload";

/**
 * THE AVATAR PIPELINE FOR A CLIENT SCREEN THAT IS NOT THE PROFILE HERO (the
 * first-run photo sheet): the same steps `AccountHero` runs, in the same
 * order. Re-encode through a canvas (square, 512px, which strips the GPS tag a
 * phone writes into a photo), upload to the member's own folder in the
 * `avatars` bucket, then `setAvatar`, which re-checks the path is theirs and
 * writes `profiles.avatar_url`. Returns a reason code, never throws; the
 * caller says it in the member's language.
 */
export const AVATAR_ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export type AvatarUploadResult =
  | { ok: true; avatarUrl: string }
  | { ok: false; reason: "type" | "size" | "unreadable" | "upload" | "attach"; message?: string };

export async function uploadAvatarPhoto(file: File, userId: string): Promise<AvatarUploadResult> {
  if (!AVATAR_ACCEPTED_TYPES.includes(file.type)) return { ok: false, reason: "type" };
  if (file.size > COVER_MAX_BYTES) return { ok: false, reason: "size" };
  try {
    const encoded = await reencodePhoto(file, { maxEdge: AVATAR_MAX_EDGE, square: true });
    if (!encoded) return { ok: false, reason: "unreadable" };
    const supabase = await loadBrowserClient();
    if (!supabase) return { ok: false, reason: "upload" };
    const path = `${userId}/${crypto.randomUUID()}.${encoded.extension}`;
    const upload = await uploadToStorage({ supabase, bucket: "avatars", path, body: encoded.blob, contentType: encoded.contentType });
    if (!upload.ok) return { ok: false, reason: "upload" };
    const result = await setAvatar({ storagePath: path });
    if (!result.ok) return { ok: false, reason: "attach", message: result.error };
    return { ok: true, avatarUrl: result.data.avatarUrl };
  } catch {
    return { ok: false, reason: "unreadable" };
  }
}
