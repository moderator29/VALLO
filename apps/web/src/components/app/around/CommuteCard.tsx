"use client";

import { Button } from "@/components/ui/Button";
import { useState, useTransition } from "react";
import type { Dictionary } from "@vallo/i18n/core";
import type { Anchor, CommuteResult } from "@/lib/listings/commute";
import { reportCommute } from "@/lib/listings/commute-actions";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * "How long did it take you?" (V-43), for members of an Around place. One
 * number to one named place, counted once a day and only in the rush-hour
 * windows the database keeps; the database says back why when it is not
 * counted. Nothing about the member is shown to anybody.
 */
export function CommuteCard({
  areaId,
  areaName,
  anchors,
  copy,
}: {
  areaId: string;
  areaName: string;
  anchors: Anchor[];
  copy: Dictionary["shape"]["commute"];
}) {
  const [anchor, setAnchor] = useState(anchors[0]?.id ?? "");
  const [minutes, setMinutes] = useState("");
  const [result, setResult] = useState<CommuteResult | null>(null);
  const [pending, startTransition] = useTransition();
  if (anchors.length === 0) return null;
  const fill = (text: string) => text.replace("{area}", areaName);

  return (
    <section className="nf-panel nf-panel--card mb-md block p-md" data-testid="commute-card">
      <h2 className="nf-h3">{copy.reportTitle}</h2>
      <p className="nf-caption mt-2xs text-[var(--nf-content-muted)]">{fill(copy.reportLede)}</p>
      {result === "ok" ? (
        <p role="status" className="nf-body-sm mt-sm text-[var(--nf-content-primary)]">
          {copy.results.ok}
        </p>
      ) : (
        <form
          className="mt-sm grid gap-sm"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              try {
                setResult(await reportCommute(areaId, anchor, Number(minutes)));
              } catch (error) {
                if (!tapFailedOffline(error)) throw error;
              }
            });
          }}
        >
          <label className="block">
            <span className="nf-label mb-inline block">{copy.reportAnchor}</span>
            <select className="nf-field" value={anchor} onChange={(event) => setAnchor(event.target.value)}>
              {anchors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}, {a.city}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="nf-label mb-inline block">{copy.reportMinutes}</span>
            <input
              className="nf-field"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={3}
              value={minutes}
              onChange={(event) => setMinutes(event.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
              data-testid="commute-minutes"
            />
          </label>
          <Button type="submit" variant="primary" disabled={pending || minutes === ""}>
            {copy.reportSend}
          </Button>
          {result && (
            <p role="status" className="nf-body-sm text-[var(--nf-content-secondary)]">
              {fill(copy.results[result])}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
