"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { setListingSharing } from "@/lib/features/roommates/actions";
import { feedback } from "@/lib/ui/feedback";
import { banner } from "@/lib/ui/toast";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

type Words = {
  label: string;
  description: string;
  people: string;
  peopleHint: string;
  save: string;
  saved: string;
  off: string;
};

/** The switch and the household size, saved together. Every outcome is a banner. */
export function SharingForm({
  listingId,
  listingTitle,
  bedrooms,
  initialOk,
  initialMax,
  words,
}: {
  listingId: string;
  listingTitle: string;
  bedrooms: number | null;
  initialOk: boolean;
  initialMax: number | null;
  words: Words;
}) {
  const [ok, setOk] = useState(initialOk);
  const [max, setMax] = useState<number>(initialMax ?? Math.max(2, bedrooms ?? 2));
  const [pending, start] = useSafeTransition();

  const save = () =>
    start(async () => {
      const res = await setListingSharing({ listingId, ok, maxOccupants: ok ? max : null });
      if (res.ok) {
        feedback("confirm");
        banner.success(res.data.ok ? words.saved.replace("{n}", String(res.data.maxOccupants)) : words.off);
      } else {
        feedback("error");
        banner.error(res.error, { retry: save });
      }
    });

  return (
    <div className="flex flex-col gap-group">
      <p className="nf-body font-semibold">{listingTitle}</p>
      <Switch checked={ok} onCheckedChange={setOk} label={words.label} description={words.description} data-testid="sharing-switch" />
      {ok ? (
        <div className="flex flex-col gap-inline">
          <span className="nf-body-sm font-semibold" id="sharing-people">
            {words.people}
          </span>
          <div className="flex items-center gap-inline" role="group" aria-labelledby="sharing-people">
            <Button variant="secondary" size="md" onClick={() => setMax((n) => Math.max(2, n - 1))} disabled={max <= 2} aria-label="Fewer people">
              -
            </Button>
            <span className="nf-h3 nf-numeric min-w-[3ch] text-center" aria-live="polite">
              {max}
            </span>
            <Button variant="secondary" size="md" onClick={() => setMax((n) => Math.min(20, n + 1))} disabled={max >= 20} aria-label="More people">
              +
            </Button>
          </div>
          <span className="nf-caption text-[var(--nf-content-secondary)]">{words.peopleHint}</span>
        </div>
      ) : null}
      <Button variant="primary" size="lg" full loading={pending} onClick={save} data-testid="sharing-save">
        {words.save}
      </Button>
    </div>
  );
}
