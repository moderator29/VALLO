"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dictionary } from "@vallo/i18n/core";
import { panelClass } from "@/components/ui/Panel";
import { PhoneField } from "@/components/app/PhoneField";
import { Button, ButtonLink } from "@/components/ui/Button";
import { saveProfilePhone } from "@/lib/settings/profile-phone";

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
  const [pending, start] = useTransition();
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
      <PhoneField
        name="phone"
        label={copy.numberLabel}
        hint={copy.profileHint}
        error={error ?? undefined}
        autoComplete="tel"
        value={phone}
        onChange={setPhone}
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
