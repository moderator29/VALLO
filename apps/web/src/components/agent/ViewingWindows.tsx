"use client";

import { State } from "@/components/ui/State";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { countOf, type Dictionary, type Locale } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { removeViewingWindow, saveViewingWindow } from "@/lib/viewings/actions";
import { windowProblem } from "@/lib/viewings/route";
import type { ViewingWindow } from "@/lib/viewings/queries";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

/**
 * V-94: THE LISTER'S VIEWING WINDOWS, on /agent/inspections. The windows in
 * force, each removable, and a form to add one: a day, a start and an end, a
 * slot length and the homes it covers (only the lister's published ones are
 * offered; the database checks ownership again). States: could not be read,
 * none yet, the list, adding, saving, a refused save in words.
 *
 * It sits beside the visit calendar (`VisitCalendar`), so a lister sets when
 * they can show next to the visits those times produce. The count of homes a
 * window covers goes through `countOf` ("1 home", "3 homes"); the line used
 * to print "1 homes".
 */

type Copy = Dictionary["frontDoor"]["viewings"];
const LENGTHS = [15, 20, 30, 45, 60] as const;

export function ViewingWindows({
  windows,
  homes,
  copy,
  locale,
  className = "mt-lg",
}: {
  windows: ViewingWindow[] | null;
  /** The lister's published homes; null when they could not be read. */
  homes: { id: string; title: string }[] | null;
  copy: Copy;
  locale: Locale;
  /** Spacing from the block above; the calendar's side column sets its own. */
  className?: string;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [weekday, setWeekday] = useState(6);
  const [starts, setStarts] = useState("10:00");
  const [ends, setEnds] = useState("14:00");
  const [slotMinutes, setSlotMinutes] = useState<(typeof LENGTHS)[number]>(20);
  const [chosen, setChosen] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useSafeTransition();

  function save() {
    const problem = windowProblem({ starts, ends, listingIds: chosen });
    if (problem) {
      setError(copy.problems[problem]);
      return;
    }
    setError(null);
    start(async () => {
      const result = await saveViewingWindow({ listingIds: chosen, weekday, starts, ends, slotMinutes });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAdding(false);
      setChosen([]);
      router.refresh();
    });
  }

  return (
    <section className={`nf-panel nf-panel--card p-card-sm ${className}`} aria-labelledby="viewing-windows-title" data-testid="viewing-windows">
      <h2 id="viewing-windows-title" className="nf-h4 text-[var(--nf-content-primary)]">
        {copy.windowsTitle}
      </h2>
      <p className="mt-inline nf-body-sm text-[var(--nf-content-secondary)]">{copy.windowsNote}</p>

      {windows === null || homes === null ? (
        <p className="mt-group nf-body-sm text-[var(--nf-content-muted)]">{copy.unreachable}</p>
      ) : windows.length === 0 ? (
        <State compact kind="empty" icon="calendar-check" title={copy.windowsEmpty} className="mt-group" />
      ) : (
        <ul className="mt-group flex flex-col gap-row">
          {windows.map((w) => (
            <li key={w.id} className="flex items-center justify-between gap-sm">
              <span className="nf-body-sm text-[var(--nf-content-primary)]">
                {copy.windowLine
                  .replace("{day}", copy.days[w.weekday] ?? "")
                  .replace("{starts}", w.starts)
                  .replace("{ends}", w.ends)
                  .replace("{minutes}", String(w.slotMinutes))
                  .replace("{homes}", countOf(w.listingIds.length, "homes", locale))}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const result = await removeViewingWindow({ id: w.id });
                    if (!result.ok) setError(result.error);
                    else router.refresh();
                  })
                }
              >
                {copy.remove}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {windows !== null && homes !== null &&
        (adding ? (
          <div className="mt-group flex flex-col gap-row" data-testid="viewing-window-form">
            {homes.length === 0 ? (
              <p className="nf-body-sm text-[var(--nf-content-muted)]">{copy.noHomes}</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-row">
                  <label className="block">
                    <span className="nf-label">{copy.weekday}</span>
                    <select className="nf-field" value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
                      {copy.days.map((name, i) => (
                        <option key={name} value={i}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="nf-label">{copy.slotLength}</span>
                    <select
                      className="nf-field"
                      value={slotMinutes}
                      onChange={(e) => setSlotMinutes(Number(e.target.value) as (typeof LENGTHS)[number])}
                    >
                      {LENGTHS.map((m) => (
                        <option key={m} value={m}>
                          {copy.minutes.replace("{count}", String(m))}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="nf-label">{copy.starts}</span>
                    <input type="time" className="nf-field" value={starts} onChange={(e) => setStarts(e.target.value)} />
                  </label>
                  <label className="block">
                    <span className="nf-label">{copy.ends}</span>
                    <input type="time" className="nf-field" value={ends} onChange={(e) => setEnds(e.target.value)} />
                  </label>
                </div>
                <fieldset>
                  <legend className="nf-label">{copy.homes}</legend>
                  <div className="mt-inline flex flex-col gap-xs">
                    {homes.map((home) => (
                      <label key={home.id} className="flex items-center gap-sm nf-body-sm text-[var(--nf-content-primary)]">
                        <input
                          type="checkbox"
                          checked={chosen.includes(home.id)}
                          onChange={(e) =>
                            setChosen((prev) => (e.target.checked ? [...prev, home.id] : prev.filter((id) => id !== home.id)))
                          }
                        />
                        {home.title}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="flex flex-wrap gap-sm">
                  <Button variant="primary" loading={pending} onClick={save}>
                    {pending ? copy.saving : copy.save}
                  </Button>
                  <Button variant="ghost" disabled={pending} onClick={() => setAdding(false)}>
                    {copy.cancel}
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : (
          <Button variant="secondary" className="mt-group" onClick={() => setAdding(true)}>
            {copy.addWindow}
          </Button>
        ))}

      {error && (
        <p className="mt-inline nf-body-sm font-semibold text-[var(--nf-state-error)]" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
