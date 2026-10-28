"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { reencodeToJpeg } from "@/components/social/profile/reencode";
import { loadBrowserClient } from "@/lib/supabase/load-client";
import { publishStory } from "@/lib/social/stories-actions";
import { uploadFailureText, uploadToStorage, withTimeout } from "@/lib/media/upload";
import {
  STORY_COPY,
  STORY_FAILURE,
  STORY_HEADLINE_MAX,
  STORY_IMAGE_MAX_BYTES,
  STORY_IMAGE_MAX_EDGE,
  STORY_PLACE_MAX,
  STORY_STANDFIRST_MAX,
} from "@/lib/social/stories-model";
import { IconPlate } from "@/components/ui/IconPlate";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { initial as initialOf } from "@/lib/text/initial";
import { useClientCopy } from "@/lib/i18n/client-copy";
import { useSignInHref } from "@/lib/auth/use-sign-in-href";
import "../feed/feed-v2.css";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

/**
 * Writing a story.
 *
 * Picture, headline, opening line, place, publish. In that order, because the
 * picture is the thing that decides whether the story gets read and choosing it
 * first is what makes the rest feel like captioning rather than filling in a
 * form.
 *
 * **The picture is re-encoded on the phone before it is uploaded**, which
 * strips the GPS tag a camera writes, and a failure REFUSES rather than falling
 * back to the original file. A story is a photograph of a real place, usually
 * somebody's own street, so this is the one rule in the feature with no
 * exception. The same technique is already used by the listing wizard, the
 * account avatar and the profile cover.
 *
 * The upload happens here and the row is written by the server action, in that
 * order, so a story never exists without the object it points at. The reverse
 * ordering would leave a row rendering a broken image.
 */

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

export function StoryComposer({
  areas,
  userId,
  signedIn,
  you = null,
}: {
  areas: { id: string; name: string; city: string }[];
  userId: string | null;
  signedIn: boolean;
  /** Who is writing: the face and name shown at the top, as the post composer does. */
  you?: { label: string; avatarUrl: string } | null;
}) {
  const words = useClientCopy().feedV2.composer;
  const signInHref = useSignInHref();
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [headline, setHeadline] = useState("");
  const [standfirst, setStandfirst] = useState("");
  const [place, setPlace] = useState("");
  const [areaId, setAreaId] = useState(areas[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [held, setHeld] = useState(false);
  const [pending, startTransition] = useSafeTransition();
  /* 0 to 1 while the picture is on its way, so "Publishing" is never a
     spinner that might be stuck. */
  const [sent, setSent] = useState<number | null>(null);
  /* The object already in the bucket for the picture on screen, so a retry
     after a failed publish writes the row against it instead of uploading
     another copy nobody will ever read. */
  const uploaded = useRef<{ blob: Blob; path: string } | null>(null);
  /* A preview URL holds its picture in memory until it is revoked: the old
     one goes when a new picture replaces it, the last one when the composer
     closes. */
  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  if (!signedIn || !userId) {
    return (
      <div className="nf-panel nf-panel--card p-xl text-center">
        <IconPlate size="lg" tone="brand">
          <UiIcon name="camera" size={24} />
        </IconPlate>
        <h2 className="nf-h3 mt-md text-[length:var(--nf-text-body-lg)]">Sign in to write a story</h2>
        <p className="mx-auto mt-xs max-w-sm text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
          A story is a picture, a headline and a line or two about a place. It
          stays up, so it needs to belong to somebody.
        </p>
        <Link href={signInHref} className="nf-btn nf-btn--primary mt-lg">
          Sign in
        </Link>
      </div>
    );
  }

  if (areas.length === 0) {
    return (
      <div className="nf-panel nf-panel--card p-xl text-center">
        <IconPlate size="lg" tone="brand">
          <UiIcon name="location" size={24} />
        </IconPlate>
        <h2 className="nf-h3 mt-md text-[length:var(--nf-text-body-lg)]">A story belongs to a place</h2>
        <p className="mx-auto mt-xs max-w-sm text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
          You are not in any place yet. Join one and you can write about it
          straight away.
        </p>
        {/* The directory, because being in no place is what this state is
            about and only the directory can end it. */}
        <Link href="/around/settings" className="nf-btn nf-btn--primary mt-lg">
          Find a place
        </Link>
      </div>
    );
  }

  if (held) {
    return (
      <div className="nf-panel nf-panel--card p-xl text-center">
        <IconPlate size="lg" tone="brand">
          <UiIcon name="file-check" size={24} />
        </IconPlate>
        <h2 className="nf-h3 mt-md text-[length:var(--nf-text-body-lg)]">It is with us</h2>
        <p className="mx-auto mt-xs max-w-sm text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
          {STORY_COPY.held}
        </p>
        <Link href="/around" className="nf-btn nf-btn--primary mt-lg">
          Back to Around
        </Link>
      </div>
    );
  }

  async function choose(file: File) {
    setError(null);
    if (!ACCEPTED.includes(file.type)) {
      setError(STORY_FAILURE.wrongType);
      return;
    }
    if (file.size > STORY_IMAGE_MAX_BYTES) {
      setError(STORY_FAILURE.tooBig);
      return;
    }
    const prepared = await reencodeToJpeg(file, { maxEdge: STORY_IMAGE_MAX_EDGE });
    if (!prepared) {
      /* Deliberately not falling back to the original file. */
      setError(STORY_FAILURE.reencode);
      return;
    }
    /* Measured after the re-encode, so the row records the pixels that were
       actually stored rather than the ones the camera produced. */
    try {
      const bitmap = await createImageBitmap(prepared);
      setSize({ width: bitmap.width, height: bitmap.height });
      bitmap.close();
    } catch {
      setSize(null);
    }
    setBlob(prepared);
    setPreview(URL.createObjectURL(prepared));
  }

  /* The picture and the headline are the story. A standfirst is optional,
     because a photograph with a good headline is already a piece. */
  /* The picture is the story; the caption is optional and any length (the
     founder, 8 October: "even if it's just T"). Only the second line written:
     it becomes the headline. Nothing written: a picture-only story. */
  const written = headline.trim() || standfirst.trim();
  const finalHeadline = written.slice(0, STORY_HEADLINE_MAX);
  const finalStandfirst = headline.trim() ? standfirst.trim() : "";
  /* Publish is never a dead grey button: a tap says what is missing. */
  const canPublish = !pending;

  const publish = () => {
    if (!blob || !userId) {
      setError(STORY_COPY.needsImage);
      return;
    }
    setError(null);

    startTransition(async () => {
      /* A throw (a dropped connection, a server action that did not answer)
         is said here in the composer, never handed to the error boundary with
         the person's writing still in it. */
      let stage: "upload" | "publish" = "upload";
      try {
        let path = uploaded.current?.blob === blob ? uploaded.current.path : null;
        if (!path) {
          const supabase = await loadBrowserClient();
          if (!supabase) {
            setError(STORY_FAILURE.upload);
            return;
          }
          /* The post id is not known yet, so the object goes under a fresh uuid in
             the person's own folder. The bucket's insert policy only checks the
             first path segment; the read policy resolves the post id out of the
             second, which the server action fills in when it writes the media row. */
          const fresh = `${userId}/${crypto.randomUUID()}.jpg`;
          const upload = await uploadToStorage({
            supabase,
            bucket: "social-media",
            path: fresh,
            body: blob,
            contentType: "image/jpeg",
            onProgress: setSent,
          });
          if (!upload.ok) {
            setSent(null);
            setError(uploadFailureText(upload.reason));
            return;
          }
          uploaded.current = { blob, path: fresh };
          path = fresh;
        }

        stage = "publish";
        setSent(null);
        const result = await withTimeout(
          publishStory({
            areaId,
            headline: finalHeadline,
            standfirst: finalStandfirst,
            placeLabel: place.trim(),
            imagePath: path,
            ...(size ? { width: size.width, height: size.height } : {}),
          }),
          30_000,
        );

        if (!result.ok) {
          setError(result.error);
          return;
        }
        if (result.data.held) {
          setHeld(true);
          return;
        }
        router.replace(`/stories/${result.data.storyId}`);
      } catch {
        setSent(null);
        setError(stage === "upload" ? STORY_FAILURE.upload : STORY_FAILURE.down);
      }
    });
  };

  return (
    <form
      className="nf-story-form flex flex-col gap-md"
      onSubmit={(event) => {
        event.preventDefault();
        if (canPublish) publish();
      }}
    >
      {/* Who is writing, the same top line the post composer has. */}
      <div className="nf-compose-who" data-testid="story-who">
        <span className="nf-compose-who__face" aria-hidden="true">
          {you?.avatarUrl ? (
            <RemoteImage src={you.avatarUrl} alt="" width={88} height={88} sizes="44px" />
          ) : (
            <span className="nf-compose-who__monogram">{initialOf(you?.label)}</span>
          )}
        </span>
        <span className="nf-compose-who__text">
          <span className="nf-compose-who__name">{you?.label || words.you}</span>
        </span>
      </div>

      {/*
        WHAT YOU WRITE IS WHAT POSTS (D74; the founder: posting a story was
        "so ugly and not neat not clean"). The composer is the story itself, at
        the viewer's own proportions: the picture full bleed in a tall frame,
        the near-black wash over its foot, and the headline, the line under it
        and the place typed straight onto the smoked glass card the viewer
        draws. Three labelled fields became one object you are making.
        Cropping is not offered: the viewer covers the frame from the centre
        and there is nowhere to store a crop, so a crop control would be a
        promise the post cannot keep.
      */}
      <div className={`nf-story-compose${preview ? " is-filled" : ""}`}>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="The picture you chose" className="nf-story-compose__img" />
        ) : null}
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className={preview ? "nf-story-compose__swap" : "nf-story-compose__pick"}
          aria-label={preview ? "Choose a different picture" : undefined}
        >
          {preview ? (
            <UiIcon name="camera" size={20} />
          ) : (
            <span className="nf-story-compose__prompt">
              <span className="nf-story-compose__plate">
                <UiIcon name="camera" size={24} />
              </span>
              <span className="nf-story-compose__label">{STORY_COPY.imagePrompt}</span>
              <span className="nf-story-compose__note">{STORY_COPY.imageNote}</span>
            </span>
          )}
        </button>
        <div className="nf-story-compose__wash" aria-hidden="true" />
        <div className="nf-story-compose__card">
          <textarea
            className="nf-story-compose__headline"
            rows={2}
            value={headline}
            maxLength={STORY_HEADLINE_MAX}
            placeholder={STORY_COPY.headlinePlaceholder}
            aria-label="Headline"
            onChange={(event) => setHeadline(event.target.value)}
          />
          <textarea
            className="nf-story-compose__standfirst"
            rows={2}
            value={standfirst}
            maxLength={STORY_STANDFIRST_MAX}
            placeholder={STORY_COPY.standfirstPlaceholder}
            aria-label="The opening paragraph"
            onChange={(event) => setStandfirst(event.target.value)}
          />
          <label className="nf-story-compose__place">
            <UiIcon name="location" size={12} />
            <input
              value={place}
              maxLength={STORY_PLACE_MAX}
              placeholder={STORY_COPY.placePlaceholder}
              aria-label="Where it happened"
              onChange={(event) => setPlace(event.target.value)}
            />
          </label>
        </div>
      </div>

      {areas.length > 1 ? (
        <label className="block">
          <span className="nf-overline">Which place is it about</span>
          <select
            className="nf-field mt-xs w-full"
            value={areaId}
            onChange={(event) => setAreaId(event.target.value)}
          >
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                Around {area.name}, {area.city}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-[var(--nf-radius-md)] border border-[var(--nf-state-error)] bg-[var(--nf-state-error-surface)] px-sm py-sm text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-primary)]"
        >
          {error}
        </p>
      ) : null}

      <Button type="submit" variant="primary" full loading={pending} disabled={!canPublish}>
        {pending
          ? sent !== null && sent < 1
            ? `${STORY_COPY.publishing} ${Math.round(sent * 100)}%`
            : STORY_COPY.publishing
          : STORY_COPY.publish}
      </Button>

      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void choose(file);
          if (fileInput.current) fileInput.current.value = "";
        }}
      />
    </form>
  );
}
