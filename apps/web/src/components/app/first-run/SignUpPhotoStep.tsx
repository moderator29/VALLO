"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Dictionary } from "@vallo/i18n/core";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { AuthPillButton } from "@/components/auth/slate";
import { Button } from "@/components/ui/Button";
import { showSuccess } from "@/lib/ui/success-moments";
import { AVATAR_ACCEPTED_TYPES, uploadAvatarPhoto } from "@/lib/profile/avatar-upload";

/**
 * THE PROFILE PHOTO, THE LAST STEP OF SIGN-UP (13 November 2026, the founder:
 * "it should ask for a profile photo ... before your account is fully up,
 * with a Skip button, clean, high end").
 *
 * One calm screen: a large round preview, two ways to a photo (the library,
 * or the camera, which inside the app is the phone's own camera through the
 * file input's `capture`), Continue, and a Skip that is a plain button in
 * plain sight. The photo is cropped to the circle the preview shows: the
 * centre square, the same crop the avatar pipeline stores
 * (`lib/profile/avatar-upload.ts`, reused, never a second path: re-encoded
 * through a canvas, which strips a phone's location tag, then the member's own
 * folder in `avatars`, then `setAvatar`).
 *
 * NEVER A WALL ON A WEAK SIGNAL. Skip always works, and works at once. An
 * upload that fails, or that has not finished in UPLOAD_WAIT_MS, says so in
 * one line and lets the person go on; the photo can be added any time from
 * the profile.
 */
export const UPLOAD_WAIT_MS = 20_000;

type Copy = Dictionary["profileSetup"]["step"];

export function SignUpPhotoStep({
  copy,
  userId,
  next,
  upload = uploadAvatarPhoto,
}: {
  copy: Copy;
  userId: string;
  next: string;
  /** The avatar pipeline; a test stages its answer here. */
  upload?: typeof uploadAvatarPhoto;
}) {
  const router = useRouter();
  const library = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "saving" | "failed">("idle");
  const leaving = useRef(false);

  /* The preview's object URL, let go when another is chosen or the step leaves. */
  const shown = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (shown.current) URL.revokeObjectURL(shown.current);
    },
    [],
  );

  const go = () => {
    if (leaving.current) return;
    leaving.current = true;
    router.replace(next);
  };

  const pick = (picked: File | undefined) => {
    if (!picked) return;
    if (shown.current) URL.revokeObjectURL(shown.current);
    shown.current = URL.createObjectURL(picked);
    setPreview(shown.current);
    setFile(picked);
    setPhase("idle");
  };

  const save = async () => {
    if (!file || phase === "saving") return;
    setPhase("saving");
    const late = new Promise<"late">((resolve) => window.setTimeout(() => resolve("late"), UPLOAD_WAIT_MS));
    const result = await Promise.race([upload(file, userId).catch(() => null), late]);
    if (result && result !== "late" && result.ok) {
      showSuccess("photo-added");
      go();
      return;
    }
    setPhase("failed");
  };

  const inputs = (
    <>
      <input
        ref={library}
        type="file"
        accept={AVATAR_ACCEPTED_TYPES.join(",")}
        className="hidden"
        data-testid="signup-photo-library"
        onChange={(event) => {
          pick(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        data-testid="signup-photo-camera"
        onChange={(event) => {
          pick(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </>
  );

  return (
    <div className="nf-auth__screen" data-testid="signup-photo">
      <div className="nf-slate-stagger grid justify-items-center gap-md text-center">
        <h1 className="nf-auth__title">{copy.title}</h1>
        <p className="nf-body-sm text-[var(--nf-content-secondary)]">{copy.body}</p>

        <button
          type="button"
          onClick={() => library.current?.click()}
          disabled={phase === "saving"}
          className="grid place-items-center"
          aria-label={preview ? copy.change : copy.choose}
          data-testid="signup-photo-preview"
        >
          {/* The round target is the picture, not the control: a circle is the
              shape of the photo it will become. */}
          <span className="grid size-40 place-items-center overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--nf-brand-primary)_14%,transparent)] text-[var(--nf-brand-primary)] ring-2 ring-[color-mix(in_oklab,var(--nf-brand-primary)_40%,transparent)]">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- a local object URL of the person's own pick; nothing to optimise
              <img src={preview} alt={copy.previewLabel} className="size-full object-cover" />
            ) : (
              <span role="img" aria-label={copy.emptyLabel}>
                <UiIcon name="user" size={64} />
              </span>
            )}
          </span>
        </button>

        {phase === "failed" ? (
          <p className="nf-body-sm text-[var(--nf-content-secondary)]" role="status" data-testid="signup-photo-failed">
            {copy.later}
          </p>
        ) : null}
      </div>

      {inputs}

      <div className="nf-auth__actions grid gap-xs">
        {file && phase !== "failed" ? (
          <AuthPillButton type="button" onClick={() => void save()} loading={phase === "saving"} className="nf-auth__cta" data-testid="signup-photo-continue">
            {phase === "saving" ? copy.saving : copy.continue}
          </AuthPillButton>
        ) : phase === "failed" ? (
          <AuthPillButton type="button" onClick={go} className="nf-auth__cta" data-testid="signup-photo-continue">
            {copy.continue}
          </AuthPillButton>
        ) : (
          <AuthPillButton type="button" onClick={() => library.current?.click()} className="nf-auth__cta" data-testid="signup-photo-choose">
            {copy.choose}
          </AuthPillButton>
        )}
        {phase !== "failed" ? (
          <AuthPillButton
            type="button"
            quiet
            disabled={phase === "saving"}
            onClick={() => (file ? library.current?.click() : camera.current?.click())}
            data-testid={file ? "signup-photo-change" : "signup-photo-take"}
          >
            {file ? copy.change : copy.take}
          </AuthPillButton>
        ) : null}
        <Button type="button" variant="quiet" size="lg" full onClick={go} data-testid="signup-photo-skip">
          {copy.skip}
        </Button>
      </div>
    </div>
  );
}
