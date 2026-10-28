"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Dictionary } from "@vallo/i18n/core";
import { panelClass } from "@/components/ui/Panel";
import { TextField } from "@/components/ui/Field";
import { Button, ButtonLink } from "@/components/ui/Button";
import { maskNational } from "@/lib/phone";
import { saveProfilePhone } from "@/lib/settings/profile-phone";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

/**
 * THE NUMBER ON FILE, while codes are not sent. One field, one save; the
 * member goes back to where they came from (the wallet's "a few details
 * first" step links here with `?next=/wallet`).
 */
export function ProfilePhoneForm({
  copy,
  currentLast,
  next,
}: {
  copy: Dictionary["trustVisible"]["phone"];
  currentLast: string | null;
  next: string | null;
}) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [savedLast, setSavedLast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useSafeTransition();
  const last = savedLast ?? currentLast;

  const save = () =>
    start(async () => {
      setError(null);
      const result = await saveProfilePhone(phone);
      if (!result.ok) return setError(result.fieldErrors?.phone ?? result.error);
      setSavedLast(result.data.last);
      setPhone("");
      if (next) router.push(next);
      else router.refresh();
    });

  return (
    <div className={panelClass({ className: "p-card space-y-row" })} data-testid="profile-phone">
      <h2 className="nf-h3 text-[var(--nf-content-primary)]">{copy.profileTitle}</h2>
      <p className="nf-body-sm text-[var(--nf-content-secondary)]">{copy.profileBody}</p>
      {last ? (
        <p className="nf-body text-[var(--nf-content-primary)]" role="status" data-testid="profile-phone-current">
          {savedLast ? copy.profileSaved : copy.profileCurrent.replace("{last}", last)}
        </p>
      ) : null}
      <TextField
        label={copy.numberLabel}
        hint={copy.profileHint}
        error={error ?? undefined}
        inputMode="tel"
        autoComplete="tel-national"
        value={maskNational(phone)}
        onChange={(event) => setPhone(event.target.value)}
        leadingIcon="phone"
      />
      <Button type="button" variant="primary" full loading={pending} onClick={save} disabled={phone.trim() === ""}>
        {pending ? copy.profileSaving : copy.profileSave}
      </Button>
      {last && next ? (
        <ButtonLink href={next} variant="secondary" full>
          {copy.profileBack}
        </ButtonLink>
      ) : null}
    </div>
  );
}
