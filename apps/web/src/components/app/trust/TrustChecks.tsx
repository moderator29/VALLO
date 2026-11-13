"use client";

import { useState } from "react";
import { IconPlate } from "@/components/ui/IconPlate";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { Sheet } from "@/components/ui/Sheet";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import type { TrustCheck, TrustCheckKind } from "@/lib/trust/checks";
import "./trust-checks.css";

/**
 * CHECKS A PERSON CAN OPEN (13 November 2026; the founder: "when click you
 * get something").
 *
 * Draws the rows `lib/trust/checks.ts` built and the sheet each one opens.
 * It decides nothing: which checks exist, their order and every word are the
 * model's. A dated row shows its date as the line under its name; an
 * explainer row (`at: null`) shows no value at all, so "how a check is
 * earned" can never be read as "this one has it" or "this one does not".
 *
 * THE SHEET SAYS FOUR THINGS, ALWAYS THE SAME FOUR: when, who, what was
 * looked at, and what it does not prove. On an explainer row "when" gives
 * way to "how it is earned", because there is no when.
 *
 * The rows are the platform's grouped list (`ListGroup`, `ListRow`), so the
 * card, the inset hairlines, the press state and the 44pt target are the
 * system's, not this file's.
 */

export type TrustCheckLabels = {
  when: string;
  who: string;
  what: string;
  means: string;
  earn: string;
  notProof: string;
  close: string;
  open: string;
};

export type TrustCheckGroup = {
  key: string;
  /** The group's label, or none for a list that has its own heading above it. */
  label?: string;
  /** "3 on record", beside the label. */
  count?: string;
  rows: TrustCheck[];
};

const ICON: Record<TrustCheckKind, UiIconName> = {
  identity: "id-card",
  identityFirm: "id-card",
  identityNimc: "user-check",
  personIdentity: "id-card",
  personIdentityNimc: "user-check",
  lasrera: "certificate",
  esvarbon: "certificate",
  cacDirector: "briefcase",
  ownership: "file-check",
  mandate: "file-text",
  inspected: "home",
  address: "location",
  availability: "calendar-check",
  photographs: "camera",
  renters: "eye",
  phone: "phone",
  email: "mail",
  promise: "users",
  ownershipSeen: "key",
};

export function TrustChecks({
  groups,
  labels,
  testId = "trust-checks",
  className = "",
}: {
  groups: TrustCheckGroup[];
  labels: TrustCheckLabels;
  testId?: string;
  className?: string;
}) {
  const [open, setOpen] = useState<TrustCheck | null>(null);
  const shown = groups.filter((group) => group.rows.length > 0);
  if (shown.length === 0) return null;

  return (
    <div className={`nf-reasons ${className}`} data-testid={testId}>
      {shown.map((group) => (
        <ListGroup
          key={group.key}
          label={group.label}
          action={group.count ? <span className="nf-reasons__count">{group.count}</span> : undefined}
          data-testid={`${testId}-${group.key}`}
        >
          {group.rows.map((row) => (
            <ListRow
              key={row.id}
              className="nf-reasons__row"
              leading={
                <IconPlate size="md" shape="round" tone={row.at ? "brand" : "neutral"}>
                  <UiIcon name={ICON[row.kind]} size={20} />
                </IconPlate>
              }
              title={row.title}
              sub={
                row.detail || row.date ? (
                  <span className="nf-reasons__sub">
                    {row.detail ? <span className="nf-reasons__detail">{row.detail}</span> : null}
                    {row.at && row.date ? (
                      <time className="nf-reasons__date" dateTime={row.at}>
                        {row.date}
                      </time>
                    ) : null}
                  </span>
                ) : undefined
              }
              chevron
              onClick={() => setOpen(row)}
              aria-label={`${row.title}${row.date ? `, ${row.date}` : ""}. ${labels.open}`}
              data-testid={`trust-check-${row.kind}`}
            />
          ))}
        </ListGroup>
      ))}

      <Sheet
        open={open !== null}
        onOpenChange={(next) => {
          if (!next) setOpen(null);
        }}
        title={open?.title ?? labels.open}
        detents={[0.7, 0.92]}
        closeLabel={labels.close}
        testId="trust-check-sheet"
      >
        {open ? (
          <dl className="nf-reasons-sheet">
            {open.at && open.date ? (
              <div className="nf-reasons-sheet__item">
                <dt>{labels.when}</dt>
                <dd>
                  <time dateTime={open.at}>{open.date}</time>
                </dd>
              </div>
            ) : null}
            {open.detail ? (
              <div className="nf-reasons-sheet__item">
                <dd className="nf-reasons-sheet__detail">{open.detail}</dd>
              </div>
            ) : null}
            <div className="nf-reasons-sheet__item">
              {/* "What was checked" only where somebody checked something:
                  the promise is a commitment the member made, and an
                  explainer row has no check behind it. */}
              <dt>{open.at && open.kind !== "promise" ? labels.what : labels.means}</dt>
              <dd>{open.what}</dd>
            </div>
            <div className="nf-reasons-sheet__item">
              <dt>{labels.who}</dt>
              <dd>{open.who}</dd>
            </div>
            {!open.at && open.earn ? (
              <div className="nf-reasons-sheet__item">
                <dt>{labels.earn}</dt>
                <dd>{open.earn}</dd>
              </div>
            ) : null}
            <div className="nf-reasons-sheet__item nf-reasons-sheet__item--limit">
              <dt>{labels.notProof}</dt>
              <dd>{open.notProof}</dd>
            </div>
          </dl>
        ) : null}
      </Sheet>
    </div>
  );
}
