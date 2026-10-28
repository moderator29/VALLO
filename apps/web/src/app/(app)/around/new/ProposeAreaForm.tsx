"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import "@/app/css/orphans.css";
import { Button } from "@/components/ui/Button";
import { Panel, panelClass } from "@/components/ui/Panel";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { TextField, SelectField, TextArea } from "@/components/ui/Field";
import { proposeArea } from "@/lib/social/areas-actions";
import {
  AREA_COPY,
  AREA_KINDS,
  AREA_KIND_HINT,
  AREA_KIND_LABEL,
  slugifyArea,
  type AreaKind,
} from "@/lib/social/areas-model";
import { useDisplayHost } from "@/lib/ui/use-display-host";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

/**
 * Suggest a place.
 *
 * The owner's rule: somebody who cannot find a conversation about Gwagwalada
 * makes one, we approve it by hand, and only then is it public. So this form
 * never pretends to open anything. It says plainly that a person reads it, and
 * the success state is honest about waiting rather than dressed up as done.
 *
 * The web address is shown as it is typed rather than asked for, because a slug
 * somebody chooses is a slug somebody squats, and a slug that surprises its
 * author gets reported as a bug.
 */
export function ProposeAreaForm({
  states,
  signedIn,
}: {
  states: { code: string; name: string }[];
  signedIn: boolean;
}) {
  const router = useRouter();
  const host = useDisplayHost();
  const [pending, startTransition] = useSafeTransition();

  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [kind, setKind] = useState<AreaKind>("AREA");
  const [stateCode, setStateCode] = useState("");
  const [blurb, setBlurb] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  const slug = slugifyArea(city, name);

  if (done) {
    return (
      <Panel as="div" variant="card" className="p-lg text-center">
        {/* No plate, and the glyph was off the scale as well as inside a box:
            22 is not a rung, and `UI_ICON_SIZES` tops out at 40, which is the
            size an object on its own is meant to be. See the note on
            `StopsDesk`'s empty state for the rest of the argument. */}
        <div className="mx-auto mb-md flex justify-center">
          <UiIcon name="verified" size={40} className="text-[var(--nf-state-success)]" />
        </div>
        <h2 className="text-[length:var(--nf-text-body-lg)] font-semibold text-[var(--nf-content-primary)]">
          Thank you. We have it.
        </h2>
        <p className="mx-auto mt-xs max-w-sm text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-muted)]">
          {AREA_COPY.proposePending}
        </p>
        <div className="mt-md flex flex-col gap-xs sm:flex-row sm:justify-center">
          <Button
            variant="primary"
            /* The directory, not the feed: the suggestion just made is printed
               there under "Waiting on us", so this is the one screen that can
               show the person what they have done. */
            onClick={() => router.push("/around/settings")}
          >
            Back to your places
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setDone(false);
              setName("");
              setCity("");
              setBlurb("");
            }}
          >
            Suggest another
          </Button>
        </div>
      </Panel>
    );
  }

  const submit = () => {
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const result = await proposeArea({ name, kind, stateCode, city, blurb });
      if (result.ok) {
        setDone(true);
        router.refresh();
        return;
      }
      setError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
    });
  };

  return (
    <form
      className="flex flex-col gap-md"
      onSubmit={(event) => {
        event.preventDefault();
        if (!pending) submit();
      }}
    >
      {!signedIn ? (
        <p className="nf-panel nf-panel--card block text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
          Sign in first and we will keep what you type here.
        </p>
      ) : null}

      <TextField
        label="What do people call it?"
        value={name}
        maxLength={60}
        placeholder="Gwagwalada"
        onChange={(event) => setName(event.target.value)}
        error={fieldErrors.name}
        hint="The name people actually say, not the official one."
      />

      <fieldset className="flex flex-col gap-xs">
        <legend className="mb-xs text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-primary)]">
          What kind of place is it?
        </legend>
        <div className="grid grid-cols-2 gap-xs">
          {AREA_KINDS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setKind(option)}
              aria-pressed={kind === option}
              className={panelClass({ variant: "card", className: "nf-orph-choice min-h-11 justify-start p-sm" })}
            >
              <span
                className="block text-[length:var(--nf-text-body-sm)] font-semibold"
              >
                {AREA_KIND_LABEL[option]}
              </span>
              <span
                className={`mt-2xs block text-[length:var(--nf-text-overline)] leading-snug ${
                  kind === option ? "text-[var(--nf-content-on-brand)]" : "text-[var(--nf-content-muted)]"
                }`}
              >
                {AREA_KIND_HINT[option]}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-md sm:grid-cols-2">
        <SelectField
          label="State"
          value={stateCode}
          onChange={(event) => setStateCode(event.target.value)}
          error={fieldErrors.stateCode}
        >
          <option value="">Choose a state</option>
          {states.map((state) => (
            <option key={state.code} value={state.code}>
              {state.name}
            </option>
          ))}
        </SelectField>

        <TextField
          label="City or town"
          value={city}
          maxLength={60}
          placeholder="Abuja"
          onChange={(event) => setCity(event.target.value)}
          error={fieldErrors.city}
        />
      </div>

      <TextArea
        label="One line about it"
        optionalText="(optional)"
        value={blurb}
        maxLength={200}
        rows={3}
        placeholder="Off the expressway, past the university gate."
        onChange={(event) => setBlurb(event.target.value)}
        hint={`${blurb.length}/200`}
      />

      {slug ? (
        <p className="nf-panel nf-panel--card block px-sm py-xs text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
          Its address will be{" "}
          <span className="nf-numeric text-[var(--nf-content-secondary)]">
            {host}/around/{slug}
          </span>
        </p>
      ) : null}

      <p className="text-[length:var(--nf-text-overline)] leading-relaxed text-[var(--nf-content-muted)]">
        {AREA_COPY.proposeWhy}
      </p>

      {error ? (
        <p
          role="alert"
          className="nf-panel nf-panel--card block border-[color-mix(in_oklab,var(--nf-state-error)_55%,transparent)] px-sm py-xs text-[length:var(--nf-text-body-sm)] text-[var(--nf-state-error)]"
        >
          {error}
        </p>
      ) : null}

      <Button type="submit" variant="primary" full disabled={pending || !signedIn}>
        {pending ? "Sending" : "Suggest this place"}
      </Button>
    </form>
  );
}
