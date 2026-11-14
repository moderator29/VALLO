"use client";

import { useMemo, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { demandLetter, mailtoHref, type LetterFacts } from "@/lib/tenancy/letter";

/** Print the pack. The browser's own dialog saves it as a PDF. */
export function PrintPack({ label }: { label: string }) {
  return (
    <Button variant="secondary" full leadingIcon="document" onClick={() => window.print()}>
      {label}
    </Button>
  );
}

/**
 * The demand letter, previewed as it will be sent, with one optional
 * paragraph in the tenant's own words, opened in their own mail app.
 */
export function DemandLetter({ facts, copy }: { facts: LetterFacts; copy: { personal: string; send: string } }) {
  const [personal, setPersonal] = useState("");
  const letter = useMemo(() => demandLetter(facts, personal), [facts, personal]);
  return (
    <div className="grid gap-md">
      <pre className="nf-body-sm whitespace-pre-wrap font-[inherit]" data-testid="demand-letter">
        {letter.body}
      </pre>
      <div className="nf-pack-noprint grid gap-sm">
        <Field label={copy.personal}>
          {(control) => (
            <textarea
              {...control}
              className="nf-field min-h-[5.5rem]"
              maxLength={1500}
              value={personal}
              onChange={(event) => setPersonal(event.target.value)}
              autoCapitalize="sentences"
            />
          )}
        </Field>
        <ButtonLink href={mailtoHref(letter)} variant="primary" full trailingIcon="arrow-right">
          {copy.send}
        </ButtonLink>
      </div>
    </div>
  );
}

/**
 * Pinned messages on the printed pack, one by one, only when the tenant ticks
 * them: they are free text and may carry an address. Unticked, a message is
 * not on the page at all, on screen or in print.
 */
export function PinnedChoice({
  pins,
  copy,
}: {
  pins: { id: string; body: string; date: string }[];
  copy: { warning: string; include: string };
}) {
  const [chosen, setChosen] = useState<Set<string>>(() => new Set());
  return (
    <div className="grid gap-sm">
      <p className="nf-pack-noprint nf-body-sm text-[var(--nf-state-warning)]">{copy.warning}</p>
      <ul className="grid gap-sm">
        {pins.map((pin) => (
          <li key={pin.id}>
            <label className="nf-pack-noprint flex min-h-[44px] items-center gap-sm">
              <input
                type="checkbox"
                checked={chosen.has(pin.id)}
                onChange={(event) =>
                  setChosen((now) => {
                    const next = new Set(now);
                    if (event.target.checked) next.add(pin.id);
                    else next.delete(pin.id);
                    return next;
                  })
                }
              />
              <span className="nf-caption">{copy.include.replace("{date}", pin.date)}</span>
            </label>
            {chosen.has(pin.id) && (
              <div>
                <p className="nf-caption">{pin.date}</p>
                <p className="nf-body-sm whitespace-pre-line">{pin.body}</p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
