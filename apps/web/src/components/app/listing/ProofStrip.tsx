"use client";

import { useState } from "react";
import type { Dictionary, Locale } from "@vallo/i18n/core";
import { Sheet } from "@/components/ui/Sheet";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { TYPE } from "@/components/app/Screen";
import {
  compactProofLines,
  proofExplainKey,
  proofLineText,
  type ProofLine,
  type ProofLineKind,
} from "@/lib/trust/proof-strip";

/**
 * THE PROOF STRIP (V-03): dated facts, on the card and the page, in one place.
 *
 * `docs/PRODUCT.md` section 6 says it in a sentence: "Inspected 12 July 2026
 * is a fact a reader can weigh; a tick is a promise." The columns that hold
 * those facts existed and reached no renter. This is where they reach one.
 *
 * WHAT IT DRAWS IS DECIDED ELSEWHERE. `lib/trust/proof-strip.ts` returns the
 * lines, in a fixed order, and only lines whose timestamp the database holds.
 * This component never adds one and never draws a placeholder: given no
 * lines it renders NOTHING, not an empty panel and not a "nothing checked
 * yet". A missing check is not a sentence the claims rule allows.
 *
 * TWO SHAPES.
 *
 *   compact  On a card, two lines at most, and NOT interactive. The card is
 *            one link to the listing, a link may not contain a button, and a
 *            tap on the card lands on the page where every line opens its
 *            sheet. So the compact lines are text, and the page is where they
 *            are explained.
 *
 *   full     On the listing page, every line, each a button that opens a
 *            sheet saying what the check is and, as prominently, what it is
 *            NOT ("We are not a land registry"). A trust claim that lists only
 *            what it covers is how a checked identity gets read as a checked
 *            building.
 *
 * Colour is never the signal: every line carries its icon and its words, and
 * the icon is decoration beside a sentence that stands on its own.
 */

const ICON: Record<ProofLineKind, UiIconName> = {
  identity: "user",
  credentials: "verified",
  authority: "document",
  availability: "calendar-booking",
  photographs: "picture",
  renters: "eye",
};

/** A line's key: its kind, and for a credential which one (several may show). */
function lineKey(line: ProofLine): string {
  return line.kind === "credentials" ? `${line.kind}-${line.credential}` : line.kind;
}

export function ProofStrip({
  lines,
  variant,
  t,
  locale,
  className = "",
}: {
  lines: ProofLine[];
  variant: "compact" | "full";
  t: Dictionary;
  locale: Locale;
  className?: string;
}) {
  const copy = t.trustVisible.proof;
  const [open, setOpen] = useState<ProofLine | null>(null);

  const shown = variant === "compact" ? compactProofLines(lines) : lines;
  if (shown.length === 0) return null;

  if (variant === "compact") {
    return (
      <ul className={`grid gap-3xs ${className}`} aria-label={copy.label} data-testid="proof-strip-compact">
        {shown.map((line) => (
          <li
            key={lineKey(line)}
            className="flex items-start gap-inline-tight text-[length:var(--nf-text-caption)] leading-snug text-[var(--nf-content-secondary)]"
          >
            <UiIcon name={ICON[line.kind]} size={12} className="mt-3xs shrink-0 text-[var(--nf-status-verified)]" />
            <span className="min-w-0 break-words">{proofLineText(line, copy, locale)}</span>
          </li>
        ))}
      </ul>
    );
  }

  const explain = open ? copy.explain[proofExplainKey(open)] : null;

  return (
    <>
      <ul className={`grid gap-inline ${className}`} aria-label={copy.label} data-testid="proof-strip">
        {shown.map((line) => (
          <li key={lineKey(line)}>
            <button
              type="button"
              onClick={() => setOpen(line)}
              aria-haspopup="dialog"
              className="nf-tap flex min-h-[44px] w-full items-start gap-inline rounded-sm py-xs text-left"
              data-testid={`proof-line-${line.kind}`}
            >
              <UiIcon
                name={ICON[line.kind]}
                size={20}
                className="mt-3xs shrink-0 text-[var(--nf-status-verified)]"
              />
              <span className={`min-w-0 flex-1 break-words ${TYPE.body}`}>
                {proofLineText(line, copy, locale)}
              </span>
              <UiIcon name="info" size={16} className="mt-3xs shrink-0 opacity-70" />
              <span className="sr-only">{copy.openHint}</span>
            </button>
          </li>
        ))}
      </ul>

      <Sheet
        open={open !== null}
        onOpenChange={(next) => {
          if (!next) setOpen(null);
        }}
        title={open ? proofLineText(open, copy, locale) : copy.label}
        detents={[0.5, 0.8]}
        closeLabel={copy.close}
      >
        {explain && (
          <div className="grid gap-block px-card pb-card">
            <section>
              <h3 className="nf-group-label">{copy.sheetIs}</h3>
              <p className={TYPE.body}>{explain.is}</p>
            </section>
            <section>
              <h3 className="nf-group-label">{copy.sheetIsNot}</h3>
              <p className={TYPE.body}>{explain.isNot}</p>
            </section>
          </div>
        )}
      </Sheet>
    </>
  );
}
