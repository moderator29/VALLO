"use client";

import { banner } from "@/lib/ui/toast";
import { uploadToStorage, withTimeout } from "@/lib/media/upload";
import { initial } from "@/lib/text/initial";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setAvatar } from "@/lib/profile/actions";
import { setSocialCover } from "@/lib/social/profiles-actions";
import { COVER_MAX_BYTES, COVER_MAX_EDGE } from "@/lib/social/profiles-model";
import { loadBrowserClient } from "@/lib/supabase/load-client";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { Button } from "@/components/ui/Button";
import { reencodePhoto } from "./reencode";
import { RemoteImage } from "@/components/ui/RemoteImage";

/**
 * The cover, and the photo of you.
 *
 * Both are re-encoded through a canvas before they are uploaded, which strips
 * every piece of metadata including the GPS tag a phone camera writes. If the
 * re-encode fails for any reason the file is REFUSED rather than uploaded as it
 * came, because a geotagged photo in a public bucket tells the internet where
 * somebody sleeps.
 *
 * The cover belongs to the social profile and lives in `social-covers`. The
 * photo of you does not: it is the one avatar this person has everywhere on the
 * platform, it lives in `avatars`, and a definer trigger projects it onto the
 * social profile whenever it changes. Uploading a second, social-only avatar
 * would be silently undone by that projection on the very next profile save, so
 * this control writes the real one through the account's own action.
 */

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const AVATAR_MAX_EDGE = 512;

export function ProfilePhotos({
  userId,
  handle,
  coverUrl,
  avatarUrl,
  displayName,
}: {
  userId: string;
  handle: string;
  coverUrl: string;
  avatarUrl: string;
  displayName: string;
}) {
  const router = useRouter();
  const coverInput = useRef<HTMLInputElement>(null);
  const avatarInput = useRef<HTMLInputElement>(null);

  const [cover, setCover] = useState(coverUrl);
  const [avatar, setAvatarUrl] = useState(avatarUrl);
  const [busy, setBusy] = useState<"cover" | "avatar" | null>(null);

  const monogram = initial(displayName || handle);

  async function prepare(file: File, square: boolean) {
    if (!ACCEPTED.includes(file.type)) {
      banner.error("Choose a JPG, PNG or WebP photo.");
      return null;
    }
    if (file.size > COVER_MAX_BYTES) {
      banner.error("That photo is over 10MB. Please choose a smaller one.");
      return null;
    }
    const result = await reencodePhoto(file, {
      maxEdge: square ? AVATAR_MAX_EDGE : COVER_MAX_EDGE,
      square,
    });
    if (!result) {
      banner.error(
        "We could not prepare that photo safely, so it was not uploaded. Try a different one.",
      );
      return null;
    }
    return result;
  }

  async function onCover(file: File) {
    setBusy("cover");
    try {
      const encoded = await prepare(file, false);
      if (!encoded) return;

      const supabase = await loadBrowserClient();
      if (!supabase) {
        banner.error("That upload did not go through. Check your connection and try again.");
        return;
      }
      const path = `${userId}/${crypto.randomUUID()}.${encoded.extension}`;
      const upload = await uploadToStorage({ supabase, bucket: "social-covers", path, body: encoded.blob, contentType: encoded.contentType });
      if (!upload.ok) {
        banner.error("That upload did not go through. Check your connection and try again.");
        return;
      }

      const result = await withTimeout(setSocialCover({ storagePath: path }), 30_000);
      if (!result.ok) {
        banner.error(result.error);
        return;
      }
      setCover(URL.createObjectURL(encoded.blob));
      banner.success("Your cover is saved.");
      router.refresh();
    } catch {
      banner.error("We could not read that photo. Try a different one.");
    } finally {
      setBusy(null);
      if (coverInput.current) coverInput.current.value = "";
    }
  }

  async function onAvatar(file: File) {
    setBusy("avatar");
    try {
      const encoded = await prepare(file, true);
      if (!encoded) return;

      const supabase = await loadBrowserClient();
      if (!supabase) {
        banner.error("That upload did not go through. Check your connection and try again.");
        return;
      }
      const path = `${userId}/${crypto.randomUUID()}.${encoded.extension}`;
      const upload = await uploadToStorage({ supabase, bucket: "avatars", path, body: encoded.blob, contentType: encoded.contentType });
      if (!upload.ok) {
        banner.error("That upload did not go through. Check your connection and try again.");
        return;
      }

      const result = await withTimeout(setAvatar({ storagePath: path }), 30_000);
      if (!result.ok) {
        banner.error(result.error);
        return;
      }
      setAvatarUrl(result.data.avatarUrl);
      banner.success("Your photo is saved, here and everywhere else on Vallo.");
      router.refresh();
    } catch {
      banner.error("We could not read that photo. Try a different one.");
    } finally {
      setBusy(null);
      if (avatarInput.current) avatarInput.current.value = "";
    }
  }

  async function removeCover() {
    setBusy("cover");
    try {
      const result = await setSocialCover({ storagePath: null });
      if (!result.ok) {
        banner.error(result.error);
        return;
      }
      setCover("");
      banner.success("Your cover is back to the house one.");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="nf-panel nf-panel--card overflow-hidden p-0">
      <div className="relative h-[7.5rem] sm:h-[9rem]">
        {cover ? (
          <RemoteImage
            src={cover}
            alt=""
            width={1200}
            height={400}
            sizes="(max-width: 640px) 100vw, 640px"
            className="nf-social-cover__photo"
          />
        ) : (
          <div className="nf-social-cover__art" aria-hidden="true" />
        )}
        <div className="nf-social-cover__scrim" aria-hidden="true" />

        <div className="absolute right-3 top-3 flex gap-xs">
          {/* A SIZE RUNG INVENTED AT THE CALL SITE STOOD HERE. It was
              `nf-btn nf-btn--glass` with `px-sm py-xs` and the overline type
              layered over it, which is the button primitive with its padding
              and its type overridden until it became a fourth height nobody
              else has. It is `size="sm"` now, which is a real rung and is 44px,
              so it also clears the tap floor it was under.
              The glyph stays: a bare word floating over a photograph is the
              one thing on this header nobody scans for, and this is how
              somebody changes the largest image on their own profile. */}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            leadingIcon="picture"
            onClick={() => coverInput.current?.click()}
            disabled={busy !== null}
            loading={busy === "cover"}
          >
            {busy === "cover" ? "Working" : cover ? "Change cover" : "Add a cover"}
          </Button>
          {/* GLASS, NOT GHOST. These two sit side by side on a photograph
              nobody has seen. The ghost variant paints nothing at all, so the
              only one of the pair that had a plate was the safe one, and the
              control that throws somebody's cover away was a floating word
              over a skyline. Both are controls, both read as controls. */}
          {cover && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void removeCover()}
              disabled={busy !== null}
            >
              Remove
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-end gap-sm px-md pb-md sm:px-lg">
        <button
          type="button"
          onClick={() => avatarInput.current?.click()}
          disabled={busy !== null}
          aria-label="Change your photo"
          className="nf-social-avatar -mt-xl cursor-pointer"
        >
          {avatar ? (
            <RemoteImage src={avatar} alt="" width={160} height={160} sizes="80px" />
          ) : (
            monogram
          )}
          {/*
            THE MARK THAT SAYS THIS IS A CONTROL.

            The avatar has been a button the whole time and looked exactly like
            an avatar, so the only way to discover that your own photo is
            editable was to tap a picture on the off chance. Every product that
            does this puts a small camera badge on the corner, and the reason it
            is a convention is that it works: it is the one element on the
            header that tells you the image is yours to change.

            `pointer-events-none` because the parent is already the button; a
            nested interactive element inside a button is a second control the
            browser has to arbitrate.
          */}
          <span className="nf-social-avatar__edit" aria-hidden="true">
            <UiIcon name="picture" size={12} />
          </span>
        </button>

        <div className="min-w-0 flex-1 pb-2xs">
          <p className="text-[length:var(--nf-text-caption)] font-semibold">
            {busy === "avatar" ? "Saving your photo" : "Your photo"}
          </p>
          <p className="mt-3xs text-[length:var(--nf-text-overline)] leading-relaxed text-[var(--nf-content-muted)]">
            This is the same photo you use everywhere on Vallo. You can also change it from{" "}
            <Link href="/profile" className="font-semibold text-[var(--nf-brand-secondary)]">
              your account
            </Link>
            .
          </p>
        </div>
      </div>

      <p className="px-md pb-md text-[length:var(--nf-text-overline)] leading-relaxed text-[var(--nf-content-muted)] sm:px-lg">
        Photos are re-encoded on your phone before they are uploaded, so the location tag a camera
        writes never leaves it.
      </p>


      <input
        ref={coverInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onCover(file);
        }}
      />
      <input
        ref={avatarInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onAvatar(file);
        }}
      />
    </section>
  );
}
