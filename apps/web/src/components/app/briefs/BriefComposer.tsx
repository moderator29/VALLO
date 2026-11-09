"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Dictionary } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { postBrief } from "@/lib/briefs/actions";
import { koboToNaira, nairaToKobo } from "@/lib/listings/search-params";
import { BRIEF_PROPERTY_TYPES, briefAreasFor, briefDraftFrom, type BriefDraft, type BriefPropertyType } from "@/lib/briefs/brief";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { banner } from "@/lib/ui/toast";

/**
 * V-95: POST A BRIEF. Facts only, chosen rather than typed: a state, one to
 * three neighbourhoods from the closed list, rent or buy, a kind, a bedroom
 * minimum, a ceiling in naira (sent as kobo) and an optional month. It can
 * start from one of the person's saved searches, or from the search that
 * found nothing. States: composing, posting, posted, refused in words.
 */

type Copy = Dictionary["frontDoor"]["briefs"];
const STATES: { code: string; name: string }[] = [
  { code: "LA", name: "Lagos" },
  { code: "FC", name: "Abuja (FCT)" },
];

export function BriefComposer({
  copy,
  saved,
  initial,
}: {
  copy: Copy;
  /** The person's saved searches, to start from. */
  saved: { id: string; label: string; params: Record<string, string> }[];
  /** A draft from the search that found nothing, when that is how they came. */
  initial: BriefDraft | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(initial !== null);
  const [draft, setDraft] = useState<BriefDraft>(
    initial ?? { stateCode: "LA", areas: [], intent: "rent", propertyType: null, bedroomsMin: null, maxMinor: null },
  );
  const [savedSearchId, setSavedSearchId] = useState<string | null>(null);
  const [budget, setBudget] = useState(draft.maxMinor !== null ? String(koboToNaira(draft.maxMinor)) : "");
  const [moveFrom, setMoveFrom] = useState("");
  const [pending, start] = useSafeTransition();
  const areas = briefAreasFor(draft.stateCode);

  function fromSaved(id: string) {
    const chosen = saved.find((s) => s.id === id);
    setSavedSearchId(chosen ? chosen.id : null);
    if (chosen) {
      const next = briefDraftFrom(chosen.params);
      setDraft(next);
      setBudget(next.maxMinor !== null ? String(koboToNaira(next.maxMinor)) : "");
    }
  }

  function submit() {
    const naira = budget.trim() === "" ? null : Number(budget.replace(/[,\s]/g, ""));
    if (naira !== null && (!Number.isInteger(naira) || naira <= 0)) {
      banner.error(copy.problems.failed);
      return;
    }
    start(async () => {
      try {
        const result = await postBrief({
          ...draft,
          /* Whole naira to kobo, integer only. */
          maxMinor: naira === null ? null : nairaToKobo(naira),
          moveFrom: moveFrom === "" ? null : moveFrom,
          savedSearchId,
        });
        if (!result.ok) {
          banner.error(result.error);
          return;
        }
        /* Said by the one banner at the top of the screen (founder, 7 November 2026). */
        banner.success(copy.posted);
        setOpen(false);
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

  if (!open) {
    return (
      <div className="flex flex-col gap-row">
        <Button variant="primary" onClick={() => setOpen(true)} data-testid="brief-open">
          {copy.post}
        </Button>
      </div>
    );
  }

  return (
    <div className="nf-panel nf-panel--card p-card-sm flex flex-col gap-row" data-testid="brief-composer">
      <h3 className="nf-body font-semibold text-[var(--nf-content-primary)]">{copy.composeTitle}</h3>
      <p className="nf-caption text-[var(--nf-content-muted)]">{copy.composeNote}</p>
      {saved.length > 0 && (
        <label className="block">
          <span className="nf-label">{copy.startFrom}</span>
          <select className="nf-field" value={savedSearchId ?? ""} onChange={(e) => fromSaved(e.target.value)}>
            <option value="">{copy.none}</option>
            {saved.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="grid grid-cols-2 gap-row">
        <label className="block">
          <span className="nf-label">{copy.state}</span>
          <select className="nf-field" value={draft.stateCode} onChange={(e) => setDraft({ ...draft, stateCode: e.target.value, areas: [] })}>
            {STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="nf-label">{copy.intent}</span>
          <select className="nf-field" value={draft.intent} onChange={(e) => setDraft({ ...draft, intent: e.target.value === "sale" ? "sale" : "rent" })}>
            <option value="rent">{copy.rent}</option>
            <option value="sale">{copy.buy}</option>
          </select>
        </label>
        <label className="block">
          <span className="nf-label">{copy.kind}</span>
          <select
            className="nf-field"
            value={draft.propertyType ?? ""}
            onChange={(e) => setDraft({ ...draft, propertyType: (e.target.value || null) as BriefPropertyType | null })}
          >
            <option value="">{copy.types.any}</option>
            {BRIEF_PROPERTY_TYPES.map((type) => (
              <option key={type} value={type}>
                {copy.types[type]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="nf-label">{copy.bedrooms}</span>
          <input
            className="nf-field"
            inputMode="numeric"
            value={draft.bedroomsMin ?? ""}
            onChange={(e) => {
              const n = Number(e.target.value);
              setDraft({ ...draft, bedroomsMin: e.target.value === "" || !Number.isInteger(n) ? null : Math.min(10, Math.max(0, n)) });
            }}
          />
        </label>
        <label className="block">
          <span className="nf-label">{copy.budget}</span>
          <input className="nf-field" inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="3,000,000" />
        </label>
        <label className="block">
          <span className="nf-label">{copy.moveFrom}</span>
          <input type="date" className="nf-field" value={moveFrom} onChange={(e) => setMoveFrom(e.target.value)} />
        </label>
      </div>
      <fieldset>
        <legend className="nf-label">{copy.areas}</legend>
        <div className="mt-inline grid grid-cols-2 gap-xs">
          {areas.map((area) => (
            <label key={area} className="flex items-center gap-sm nf-body-sm text-[var(--nf-content-primary)]">
              <input
                type="checkbox"
                checked={draft.areas.includes(area)}
                disabled={!draft.areas.includes(area) && draft.areas.length >= 3}
                onChange={(e) =>
                  setDraft({ ...draft, areas: e.target.checked ? [...draft.areas, area] : draft.areas.filter((a) => a !== area) })
                }
              />
              {area}
            </label>
          ))}
        </div>
      </fieldset>
      <Button variant="primary" loading={pending} disabled={draft.areas.length === 0} onClick={submit}>
        {pending ? copy.posting : copy.submit}
      </Button>
    </div>
  );
}
