import Link from "next/link";
import { dateTimeLabel, dayLabel } from "@/lib/format/when";
import type { Dictionary } from "@vallo/i18n/core";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { Section, TYPE } from "@/components/app/Screen";
import { planCount, type PlanGroups, type PlanItem, type PlanKind } from "./plans";

/**
 * Coming up: the one dated list at the top of Plans (V-76).
 *
 * Today, This week, Later, and every kind of commitment on it together, which
 * is the answer to "what am I doing this weekend" that three separate lists
 * never gave. Each row names its kind in words (never by icon alone) and
 * links to the place its controls live. When nothing is ahead it says so in
 * one line and the sections below still show the record.
 */
const KIND_ICON: Record<PlanKind, UiIconName> = {
  inspection: "verified",
  tenancy: "key",
  stay: "bed",
  table: "utensils",
};

/**
 * When, in words: "Today, 14:00", "Tomorrow, 10:30", then "Mon 27 Oct,
 * 14:00"; a date with no time reads "Tomorrow" or "Mon 27 Oct". One set of
 * words for a time (`lib/format/when`), on Lagos time.
 */
function when(item: PlanItem): string {
  if (item.at) {
    const timed = dateTimeLabel(item.at);
    if (timed) return timed;
  }
  /* A plain date is a Lagos calendar day: noon Lagos keeps it on that day. */
  return dayLabel(`${item.on}T12:00:00+01:00`);
}

export function ComingUp({
  groups,
  copy,
  partial = false,
}: {
  groups: PlanGroups;
  copy: Dictionary["shape"]["plans"];
  /** True when a read behind the list failed: an empty list is then unknown, not empty. */
  partial?: boolean;
}) {
  if (planCount(groups) === 0) {
    /* A failed read is said where it failed, below; "nothing ahead" here
       would be a claim this page cannot make (V-76 review). */
    if (partial) return null;
    return (
      <p className={`mb-block ${TYPE.rowMeta}`} data-testid="plans-nothing-ahead">
        {copy.nothingAhead}
      </p>
    );
  }
  const bands: { key: keyof PlanGroups; label: string }[] = [
    { key: "today", label: copy.today },
    { key: "week", label: copy.thisWeek },
    { key: "later", label: copy.later },
  ];
  return (
    <Section title={copy.comingUp} className="mb-block">
      <div data-testid="plans-coming-up" className="flex flex-col gap-md">
        {bands.map((band) =>
          groups[band.key].length === 0 ? null : (
            <div key={band.key}>
              <p className="nf-overline text-[var(--nf-content-muted)]">{band.label}</p>
              <ul className="mt-inline-tight divide-y divide-[var(--nf-panel-hair)]">
                {groups[band.key].map((item) => (
                  <li key={`${item.kind}-${item.id}`}>
                    <Link href={item.href} className="flex min-h-11 items-center gap-md py-sm">
                      <UiIcon name={KIND_ICON[item.kind]} size={20} className="shrink-0 text-[var(--nf-brand-secondary)]" />
                      <span className="min-w-0 flex-1 leading-tight">
                        <span className={`block ${TYPE.rowTitle}`}>{item.title}</span>
                        <span className={`mt-3xs block ${TYPE.rowMeta}`}>
                          {copy.kinds[item.kind]}
                          {item.where ? `, ${item.where}` : ""}
                        </span>
                      </span>
                      <span className={`nf-numeric shrink-0 text-right ${TYPE.rowMeta}`}>{when(item)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ),
        )}
      </div>
    </Section>
  );
}
