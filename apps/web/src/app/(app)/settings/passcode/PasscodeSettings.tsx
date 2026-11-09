"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@vallo/i18n/core";
import { PasscodeSetup } from "@/components/passcode/PasscodeSetup";
import type { PasscodeCopy } from "@/components/passcode/PasscodeLock";
import { forgotPasscodeAction } from "@/lib/passcode/actions";
import type { PasscodeLength } from "@/lib/passcode/rules";

/**
 * The passcode screen's controls: the length choice, "Change passcode", and
 * the way out when the code is forgotten. The change itself is the setup
 * flow drawn inline (not as the lock's modal), asking for the current code
 * first unless the member signed in moments ago.
 */
export function PasscodeSettings({
  copy,
  locale,
  state,
  length,
  askCurrent,
  name,
  avatarUrl,
}: {
  copy: PasscodeCopy;
  locale: Locale;
  state: "signed-out" | "unset" | "set" | "unavailable";
  length: PasscodeLength;
  askCurrent: boolean;
  name: string;
  avatarUrl: string;
}) {
  const router = useRouter();
  const [choice, setChoice] = useState<PasscodeLength>(length);
  const [changing, setChanging] = useState(false);
  const [leaving, startLeaving] = useTransition();

  if (state === "signed-out") return null;

  if (changing || state === "unset") {
    return (
      <PasscodeSetup
        copy={copy}
        locale={locale}
        mode={state === "unset" ? "first" : "change"}
        name={name}
        avatarUrl={avatarUrl}
        overlay={false}
        askCurrent={state === "set" && askCurrent}
        currentLength={length}
        initialLength={choice}
        onDone={() => {
          /* PasscodeSetup has already said it through the one banner
             (`showSuccess`, the passcode-set and passcode-changed flags). */
          setChanging(false);
          router.refresh();
        }}
      />
    );
  }

  return (
    <div className="nf-panel nf-panel--card nf-passcode-settings" data-testid="passcode-settings">
      <fieldset className="nf-passcode-settings__length">
        <legend className="nf-passcode-settings__label">{copy.lengthLabel}</legend>
        <div className="nf-passcode-settings__segments" role="radiogroup" aria-label={copy.lengthLabel}>
          {([6, 4] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={choice === value}
              className={`nf-passcode-settings__segment${choice === value ? " nf-passcode-settings__segment--on" : ""}`}
              onClick={() => setChoice(value)}
            >
              {value === 6 ? copy.lengthSix : copy.lengthFour}
            </button>
          ))}
        </div>
      </fieldset>
      <p className="nf-passcode-settings__note">{copy.lockNote}</p>
      {state === "unavailable" ? <p className="nf-passcode-settings__note">{copy.unavailable}</p> : null}
      <button
        type="button"
        className="nf-btn nf-btn--primary w-full"
        onClick={() => setChanging(true)}
        data-testid="passcode-change"
      >
        {copy.change}
      </button>
      <p className="nf-passcode-settings__note">{copy.forgot}</p>
      <button
        type="button"
        className="nf-passcode__link"
        disabled={leaving}
        onClick={() => startLeaving(() => forgotPasscodeAction("/settings/passcode"))}
      >
        {copy.usePassword}
      </button>
    </div>
  );
}
