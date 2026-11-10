"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Dictionary } from "@vallo/i18n/core";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { banner } from "@/lib/ui/toast";
import { showSuccess } from "@/lib/ui/success-moments";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { confirmProfileName, markProfileSetupShown, skipProfileSetup } from "@/lib/first-run/profile-setup-actions";
import type { SetupStep } from "@/lib/first-run/profile-setup-core";
import { AVATAR_ACCEPTED_TYPES, uploadAvatarPhoto } from "@/lib/profile/avatar-upload";

/**
 * THE FIRST-RUN SHEETS: "Confirm your information", then "Add a profile
 * photo", over whatever page the member landed on. Each is skippable. Closing
 * or skipping the last one starts the quiet days (`profile-setup-core.ts`), so
 * the ask returns on a later visit and never twice in one session. Saving the
 * name or the photo says so in the top banner (`showSuccess`).
 *
 * The photo goes through the profile's own avatar pipeline
 * (`lib/profile/avatar-upload.ts`). Every tap runs inside `useSafeTransition`,
 * the one try/catch the tap-failed rule asks for, and a refusal the server
 * returns is said before anything else happens.
 */
export function ProfileSetupSheets({
  copy,
  steps,
  initialName,
  userId,
}: {
  copy: Dictionary["profileSetup"];
  steps: SetupStep[];
  initialName: string;
  userId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [index, setIndex] = useState(0);
  const [fullName, setFullName] = useState(initialName);
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [pending, run] = useSafeTransition();
  const file = useRef<HTMLInputElement>(null);
  const step = steps[index];

  /* Opening is the "shown this session" mark: a refresh or another tab will
     not open it again. Fire and forget; a failure only means one extra ask. */
  useEffect(() => {
    void markProfileSetupShown().catch(() => undefined);
  }, []);

  /* Leaving the last step, or the X on any step: the quiet days begin. */
  const finish = (skipped: boolean) => {
    setOpen(false);
    if (skipped) void skipProfileSetup().catch(() => undefined);
    router.refresh();
  };
  const next = () => (index + 1 < steps.length ? setIndex(index + 1) : finish(false));
  const skip = () => (index + 1 < steps.length ? setIndex(index + 1) : finish(true));

  const saveName = () =>
    run(async () => {
      setNameError(undefined);
      const result = await confirmProfileName({ fullName });
      if (!result.ok) {
        if (result.fieldErrors?.fullName) setNameError(result.fieldErrors.fullName);
        else banner.error(result.error || copy.name.failed);
        return;
      }
      showSuccess("profile-confirmed");
      next();
    });

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

  if (!step) return null;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : finish(true))}
      title={step === "name" ? copy.name.title : copy.photo.title}
      description={step === "name" ? copy.name.description : copy.photo.description}
      closeLabel={copy.close}
      detents={step === "name" ? [0.62] : [0.7]}
      testId={step === "name" ? "setup-name-sheet" : "setup-photo-sheet"}
      footer={
        <div className="grid gap-xs">
          {step === "name" ? (
            <Button onClick={saveName} loading={pending} disabled={fullName.trim() === ""} full data-testid="setup-name-save">
              {copy.name.save}
            </Button>
          ) : (
            <Button onClick={() => file.current?.click()} loading={pending} variant="secondary" full data-testid="setup-photo-choose">
              {copy.photo.choose}
            </Button>
          )}
          <Button onClick={skip} variant="quiet" full disabled={pending} data-testid="setup-skip">
            {copy.skip}
          </Button>
        </div>
      }
    >
      {step === "name" ? (
        <TextField
          label={copy.name.fieldLabel}
          value={fullName}
          onChange={(event) => {
            setFullName(event.target.value);
            if (nameError) setNameError(undefined);
          }}
          error={nameError}
          autoComplete="name"
          maxLength={160}
          enterKeyHint="done"
          data-testid="setup-name-input"
        />
      ) : (
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
      )}
    </Sheet>
  );
}
