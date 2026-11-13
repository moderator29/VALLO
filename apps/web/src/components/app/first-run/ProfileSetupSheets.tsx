"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Dictionary } from "@vallo/i18n/core";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { banner } from "@/lib/ui/toast";
import { showSuccess } from "@/lib/ui/success-moments";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { markProfileSetupShown, skipProfileSetup } from "@/lib/first-run/profile-setup-actions";
import { AVATAR_ACCEPTED_TYPES, uploadAvatarPhoto } from "@/lib/profile/avatar-upload";

/**
 * THE FIRST-RUN PHOTO SHEET: "Add a profile photo", over whatever page the
 * member landed on, skippable. Closing or skipping starts the quiet days
 * (`profile-setup-core.ts`), so the ask returns on a later visit and never
 * twice in one session. Saving the photo says so in the top banner
 * (`showSuccess`).
 *
 * "CONFIRM YOUR INFORMATION" WAS THE FIRST STEP AND IS GONE (13 November 2026,
 * the founder): the name is given at sign-up on every path that makes an
 * account, so asking for it again was a sheet with nothing to do.
 *
 * The photo goes through the profile's own avatar pipeline
 * (`lib/profile/avatar-upload.ts`). Every tap runs inside `useSafeTransition`,
 * the one try/catch the tap-failed rule asks for, and a refusal the server
 * returns is said before anything else happens.
 */
export function ProfileSetupSheets({ copy, userId }: { copy: Dictionary["profileSetup"]; userId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [pending, run] = useSafeTransition();
  const file = useRef<HTMLInputElement>(null);

  /* Opening is the "shown this session" mark: a refresh or another tab will
     not open it again. Fire and forget; a failure only means one extra ask. */
  useEffect(() => {
    void markProfileSetupShown().catch(() => undefined);
  }, []);

  /* Leaving the sheet, by the photo or by a skip: the quiet days begin on a skip. */
  const finish = (skipped: boolean) => {
    setOpen(false);
    if (skipped) void skipProfileSetup().catch(() => undefined);
    router.refresh();
  };
  const choose = (picked: File) =>
    run(async () => {
      const result = await uploadAvatarPhoto(picked, userId);
      if (!result.ok) {
        const message =
          result.reason === "type"
            ? copy.photo.badType
            : result.reason === "size"
              ? copy.photo.tooBig
              : result.reason === "unreadable"
                ? copy.photo.unreadable
                : (result.message ?? copy.photo.failed);
        banner.error(message);
        return;
      }
      showSuccess("photo-added");
      finish(false);
    });

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : finish(true))}
      title={copy.photo.title}
      description={copy.photo.description}
      closeLabel={copy.close}
      detents={[0.7]}
      testId="setup-photo-sheet"
      footer={
        <div className="grid gap-xs">
          <Button onClick={() => file.current?.click()} loading={pending} variant="secondary" full data-testid="setup-photo-choose">
            {copy.photo.choose}
          </Button>
          <Button onClick={() => finish(true)} variant="quiet" full disabled={pending} data-testid="setup-skip">
            {copy.skip}
          </Button>
        </div>
      }
    >
      <div className="grid place-items-center py-md">
        <span
          role="img"
          aria-label={copy.photo.avatarLabel}
          className="grid size-32 place-items-center rounded-full bg-[color-mix(in_oklab,var(--nf-brand-primary)_14%,transparent)] text-[var(--nf-brand-primary)]"
        >
          <UiIcon name="user" size={56} />
        </span>
        <input
          ref={file}
          type="file"
          accept={AVATAR_ACCEPTED_TYPES.join(",")}
          className="hidden"
          data-testid="setup-photo-input"
          onChange={(event) => {
            const picked = event.target.files?.[0];
            event.target.value = "";
            if (picked) choose(picked);
          }}
        />
      </div>
    </Sheet>
  );
}
