"use client";

import { initial } from "@/lib/text/initial";
import "./profile.css";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Locale } from "@vallo/i18n/core";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { setAvatar } from "@/lib/profile/actions";
import { setSocialCover } from "@/lib/social/profiles-actions";
import { COVER_MAX_BYTES, COVER_MAX_EDGE } from "@/lib/social/profiles-model";
import { loadBrowserClient } from "@/lib/supabase/load-client";
import { reencodeToJpeg } from "@/components/social/profile/reencode";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { ButtonLink } from "@/components/ui/Button";
import type { BadgeTier } from "./belongings";
import { useClientCopy } from "@/lib/i18n/client-copy";
import { IdentityHeader } from "@/components/app/identity/IdentityHeader";
import { BackChevron } from "@/components/social/profile/BackChevron";
import { uploadToStorage } from "@/lib/media/upload";

/**
 * THE TOP OF YOUR OWN PROFILE, BUILT TO `50E032EA`.
 *
 * Measured off the render (a 658px screen inside the frame, so one CSS pixel at
 * 390 is 1.687 image pixels; every number is in the ledger, section 1): a dusk
 * photograph across the top that fades into the page, a back control at the
 * upper left and a settings gear at the upper right riding on it (both the
 * bare glyph the public profile's corners wear), then the person. An 88px ROUND face on a lit blue ring (the
 * render puts a small tick on it too; the founder asked for one mark, beside
 * the name, on 25 September 2026), and beside it the name with its tick, the handle,
 * one line of bio, and Followers and Following split by a hairline.
 *
 * Every word and number here is the database's:
 *
 *   name       `profiles.display_name` (first and surname as the fallback)
 *   handle     `social_profiles.handle`
 *   bio        `social_profiles.bio`
 *   counts     `social_profiles.follower_count` and `following_count`, kept by
 *              the `follows_count` trigger (`bump_follow_counts`) on every
 *              follow and unfollow
 *   badge      `public.person_badge.tier` (the one derivation), into
 *              `TierBadge`, which draws nothing for a person without a tier
 *   face       `profiles.avatar_url`
 *   cover      `social_profiles.cover_path`, or the founder's villa plate
 *              when nobody has set one
 *
 * These classes are this surface's own (`nf-pf-*`, in `profile.css`) and not
 * the social layer's. The public page at `/u/[handle]` still wears the social
 * classes in `social.css`, which the social layer owns; the two used to
 * share one set, and every change made for one moved the other.
 *
 * BOTH PHOTOS ARE CHANGED HERE. Tapping the face opens its picker; the
 * "Cover photo" row under the belongings opens the cover's. Both are
 * re-encoded through a canvas before upload, which strips the GPS tag a phone
 * camera writes. A failed re-encode REFUSES the file rather than falling back
 * to the original: both buckets are public.
 */

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
/** The cover picker's id, pressed by the "Cover photo" row in `AccountBody`. */
export const COVER_INPUT_ID = "account-cover-input";
const AVATAR_MAX_EDGE = 512;


export type HeroIdentity = {
  handle: string;
  coverUrl: string;
  followerCount: number;
  followingCount: number;
  postCount: number;
  isAgent: boolean;
  bio: string;
};

export function AccountHero({
  userId,
  displayName,
  email,
  avatarUrl,
  identity,
  badgeTier = null,
  roleLine,
  locale,
  credentials = null,
  postsLabel = "Posts",
}: {
  userId: string;
  displayName: string;
  email: string;
  avatarUrl: string;
  /** Null when this person has not claimed a handle. */
  identity: HeroIdentity | null;
  /** From `public.person_badge`, the one source. Null means no badge. */
  badgeTier?: BadgeTier;
  /** The one line under the name (`lib/profile/role-line.ts`), worded by the server page. */
  roleLine?: string;
  /**
   * Place and member-since. Accepted for the callers that still pass it; the
   * header draws neither: the place is a row under the belongings and the
   * joining month is in the credentials section, where nothing is lost.
   */
  metaLine?: { place: string; joined: string };
  /** The locale, NOT a formatter: a function cannot cross into a client component. */
  locale: Locale;
  /**
   * The credentials section (`IdentityCredentials`), built by the server
   * page: the badge row and its earned moment, the Vallo passport and, for
   * a lister, the Vallo Record. Drawn under the header's actions, as
   * somebody else's page draws theirs.
   */
  credentials?: React.ReactNode;
  /** The word under the posts count, in the reader's language (`socialProfile.posts`). */
  postsLabel?: string;
}) {
  const router = useRouter();
  const COPY = useClientCopy().socialProfile.accountPage;
  /* The counts are formatted once, in `IdentityHeader`, for both profiles. */
  const coverInput = useRef<HTMLInputElement>(null);
  const avatarInput = useRef<HTMLInputElement>(null);

  const [cover, setCover] = useState(identity?.coverUrl ?? "");
  const [avatar, setAvatarState] = useState(avatarUrl);
  const [busy, setBusy] = useState<"cover" | "avatar" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const shownName = displayName.trim() || email || "Your account";
  const monogram = initial(displayName.trim() || identity?.handle || email);

  async function prepare(file: File, square: boolean): Promise<Blob | null> {
    setError(null);
    if (!ACCEPTED.includes(file.type)) {
      setError("Choose a JPG, PNG or WebP photo.");
      return null;
    }
    if (file.size > COVER_MAX_BYTES) {
      setError("That photo is over 10MB. Please choose a smaller one.");
      return null;
    }
    const blob = await reencodeToJpeg(file, {
      maxEdge: square ? AVATAR_MAX_EDGE : COVER_MAX_EDGE,
      square,
    });
    if (!blob) {
      setError(
        "We could not prepare that photo safely, so it was not uploaded. Try a different one.",
      );
      return null;
    }
    return blob;
  }

  async function onCover(file: File) {
    setBusy("cover");
    try {
      const blob = await prepare(file, false);
      if (!blob) return;

      const supabase = await loadBrowserClient();
      if (!supabase) {
        setError("We could not upload that photo. Check your connection and try again.");
        return;
      }
      const path = `${userId}/${crypto.randomUUID()}.jpg`;
      const upload = await uploadToStorage({ supabase, bucket: "social-covers", path, body: blob, contentType: "image/jpeg" });
      if (!upload.ok) {
        setError("We could not upload that photo. Check your connection and try again.");
        return;
      }

      const result = await setSocialCover({ storagePath: path });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
      setCover(URL.createObjectURL(blob));
    } catch {
      setError("We could not read that photo. Try a different one.");
    } finally {
      setBusy(null);
      if (coverInput.current) coverInput.current.value = "";
    }
  }

  async function onAvatar(file: File) {
    setBusy("avatar");
    try {
      const blob = await prepare(file, true);
      if (!blob) return;

      const supabase = await loadBrowserClient();
      if (!supabase) {
        setError("We could not upload that photo. Check your connection and try again.");
        return;
      }
      const path = `${userId}/${crypto.randomUUID()}.jpg`;
      const upload = await uploadToStorage({ supabase, bucket: "avatars", path, body: blob, contentType: "image/jpeg" });
      if (!upload.ok) {
        setError("We could not upload that photo. Check your connection and try again.");
        return;
      }

      const result = await setAvatar({ storagePath: path });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAvatarState(result.data.avatarUrl);
      router.refresh();
    } catch {
      setError("We could not read that photo. Try a different one.");
    } finally {
      setBusy(null);
      if (avatarInput.current) avatarInput.current.value = "";
    }
  }

  return (
    <IdentityHeader
      state="mine"
      testId="account-hero"
      name={shownName}
      handle={identity?.handle ?? null}
      /* No handle, no handle line: the email it used to print there is the
         Email row under the belongings, so the page said it twice. */
      bio={identity?.bio || undefined}
      badgeTier={badgeTier}
      roleLine={roleLine}
      coverUrl={cover || undefined}
      avatar={
        /* MINE: the face is the photo picker. Same disc, same ring as
           theirs; the quiet picture mark is what says it is a control. */
        <button
          type="button"
          onClick={() => avatarInput.current?.click()}
          disabled={busy !== null}
          aria-label={avatar ? "Change your photo" : "Add a photo of you"}
          className="nf-profile-avatar"
          data-testid="account-avatar-button"
        >
          <span className="nf-profile-avatar__disc">
            {avatar ? (
              <RemoteImage src={avatar} alt="" width={192} height={192} sizes="96px" />
            ) : (
              <span aria-hidden="true">{monogram}</span>
            )}
          </span>
          <span className="nf-pf-avatar__badge nf-pf-avatar__badge--quiet" aria-hidden="true">
            <UiIcon name={busy === "avatar" ? "hourglass" : "picture"} size="2xs" />
          </span>
        </button>
      }
      counts={
        identity
          ? {
              followers: identity.followerCount,
              following: identity.followingCount,
              posts: identity.postCount,
              labels: { followers: COPY.followers, following: COPY.following, posts: postsLabel },
            }
          : null
      }
      locale={locale}
      /* The cover's two corners, as on somebody else's page: Back at the top
         left (the founder, October 2026: the profile had no way back) and the
         gear at the top right, both the bare glyph on the photograph. Back
         takes the shared decision (`docs/BACK_NAVIGATION.md`): the screen the
         person came from when that is safe, otherwise `/profile`'s declared
         parent, the home of their side. */
      topStart={<BackChevron fallback="/home" />}
      topEnd={
        <Link
          href="/settings"
          className="nf-social-round nf-btn--glass"
          aria-label={COPY.settings}
          data-testid="account-settings-button"
        >
          <UiIcon name="settings-gear" size={20} />
        </Link>
      }
      actions={
        identity ? (
          <ButtonLink href={`/u/${identity.handle}/edit`} size="sm" variant="secondary">
            {COPY.editProfile}
          </ButtonLink>
        ) : (
          <ButtonLink href="/u/me/edit" size="sm" variant="primary" data-testid="profile-claim-handle">
            {COPY.claimHandle}
          </ButtonLink>
        )
      }
    >
      {!identity ? <p className="nf-pf-claim__note">{COPY.claimHandleNote}</p> : null}
      {error && (
        <p role="alert" className="nf-pf-error">
          {error}
        </p>
      )}
      {credentials}
      {/* The cover's picker opens from the "Cover photo" row under the
          belongings (`COVER_INPUT_ID`), not from a third control here. */}
      <input
        ref={coverInput}
        id={COVER_INPUT_ID}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void onCover(file);
        }}
      />
      <input
        ref={avatarInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void onAvatar(file);
        }}
      />
    </IdentityHeader>
  );
}
