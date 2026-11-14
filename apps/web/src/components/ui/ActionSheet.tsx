"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { IconPlate } from "@/components/ui/IconPlate";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { Sheet } from "@/components/ui/Sheet";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { feedback } from "@/lib/ui/feedback";
import "./action-sheet.css";

/**
 * THE ACTION SHEET (the founder, 14 November 2026, with two Snapchat
 * screenshots: a long-press on a chat, and a "more" menu).
 *
 * The JOB those sheets do, in Vallo's material, never their look. Anatomy,
 * top to bottom, every part optional except the rows:
 *
 *   1. a HEAD CARD for the thing the sheet is about: a thumbnail or an
 *      avatar, a name, one quiet line under it, and a chevron when it opens
 *      that thing. Without `href` or `onSelect` it is a label, not a control;
 *   2. a row of up to FOUR ROUND QUICK ACTIONS, a word under each;
 *   3. a CARD OF ROWS, on the platform's `ListGroup` so a row here and a row
 *      in settings are the same row;
 *   4. a full-width DONE BAR, standing apart from the rows card.
 *
 * IT COMPOSES `Sheet`, IT DOES NOT REPLACE IT, which is the whole reason the
 * hand-rolled-sheets guard stays green. The portal, the scrim, the rise on
 * the spring, the drag and flick to close, Escape, Back, the focus trap and
 * its return, the scroll lock, the home-indicator inset and the CENTRED
 * DIALOG from 64rem with a mouse (overlays.css) are all inherited unchanged.
 * The visible head is not the title: `Sheet` gets `hideTitle`, so the sheet
 * still has one accessible name and the screen has no second heading.
 *
 * A DESTRUCTIVE ROW IS ALWAYS LAST AND ALWAYS BEHIND A CONFIRM. Give the row
 * `danger` and a `confirm`, and this file opens `ConfirmSheet` with the
 * caller's words, closes the action sheet, and runs the row only when the
 * person says yes. A danger row without `confirm` is refused in development,
 * because the guard is the point.
 *
 * COPY IS ENTIRELY THE CALLER'S. No default labels, no invented rows. A row
 * that has no backend must not be passed in.
 */

export type QuickAction = {
  key: string;
  /** The word under the circle. Also the control's accessible name. */
  label: string;
  icon: UiIconName;
  /** A real address instead of an action. */
  href?: string;
  onSelect?: () => void;
  /** Live state (saved, muted): the circle wears the lit selected fill. */
  on?: boolean;
  disabled?: boolean;
  "data-testid"?: string;
};

export type SheetRow = {
  key: string;
  label: string;
  /** The second line, where two rows would otherwise be hard to tell apart. */
  sub?: string;
  icon?: UiIconName;
  /** A real address. */
  href?: string;
  onSelect?: () => void;
  /** Opens another sheet or a page: draws the chevron. */
  chevron?: boolean;
  /** A switch, a radio or a count at the end of the row. */
  trailing?: ReactNode;
  /** Destructive: the danger colour, forced last, and `confirm` is required. */
  danger?: boolean;
  confirm?: {
    title: string;
    line: string;
    confirmLabel: string;
    cancelLabel: string;
  };
  /**
   * The caller asks the question itself, further down (the feed's own
   * `DeleteSheet`, the profile's block sheet, a report form). Without this a
   * destructive row MUST carry `confirm`: the guard is the point, and two
   * confirmations for one act is its own defect.
   */
  confirmElsewhere?: boolean;
  disabled?: boolean;
  "data-testid"?: string;
};

function QuickItem({ action, onDone }: { action: QuickAction; onDone: () => void }) {
  const inner = (
    <>
      <span className="nf-asheet__quickdisc">
        <UiIcon name={action.icon} size={20} filled={action.on} />
      </span>
      <span className="nf-asheet__quickword">{action.label}</span>
    </>
  );
  if (action.href) {
    return (
      <Link
        href={action.href}
        className="nf-asheet__quickitem"
        data-testid={action["data-testid"]}
        onClick={() => {
          action.onSelect?.();
          onDone();
        }}
      >
        {inner}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className="nf-asheet__quickitem"
      disabled={action.disabled}
      aria-pressed={action.on === undefined ? undefined : action.on}
      data-testid={action["data-testid"]}
      onClick={() => {
        feedback("select");
        action.onSelect?.();
        onDone();
      }}
    >
      {inner}
    </button>
  );
}

export function ActionSheet({
  open,
  onOpenChange,
  title,
  head,
  quick = [],
  rows,
  doneLabel,
  testId,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  /** The dialog's accessible name. Never drawn: the head card is what is seen. */
  title: string;
  /** The thing this sheet is about. */
  head?: {
    name: string;
    line?: string;
    /** A photograph already in cache (a listing's, a person's). */
    thumb?: string;
    /** Where the thumbnail is absent: a glyph on the round plate. */
    icon?: UiIconName;
    href?: string;
    onSelect?: () => void;
    "data-testid"?: string;
  };
  /** Up to four. A fifth is dropped rather than wrapped onto a second line. */
  quick?: QuickAction[];
  rows: SheetRow[];
  /** The full-width bar under everything. Omit it and no bar is drawn. */
  doneLabel?: string;
  testId?: string;
}) {
  const [confirming, setConfirming] = useState<SheetRow | null>(null);
  const close = () => onOpenChange(false);

  /* Destructive rows are always last, whatever order the caller passed. */
  const ordered = [...rows.filter((row) => !row.danger), ...rows.filter((row) => row.danger)];

  if (process.env.NODE_ENV !== "production") {
    for (const row of ordered) {
      if (row.danger && !row.confirm && !row.confirmElsewhere && !row.href) {
        throw new Error(
          `ActionSheet: the destructive row "${row.key}" needs a confirm, or confirmElsewhere when the caller asks.`,
        );
      }
    }
  }

  const headInner = head ? (
    <>
      {head.thumb ? (
        <Image src={head.thumb} alt="" width={88} height={88} className="nf-asheet__thumb" unoptimized />
      ) : (
        <IconPlate size="md" shape="round">
          <UiIcon name={head.icon ?? "user"} size={20} />
        </IconPlate>
      )}
      <span className="nf-asheet__headtext">
        <span className="nf-asheet__name">{head.name}</span>
        {head.line ? <span className="nf-asheet__line">{head.line}</span> : null}
      </span>
      {head.href || head.onSelect ? (
        <UiIcon name="chevron-right" size={18} className="nf-asheet__headchev" />
      ) : null}
    </>
  ) : null;

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={onOpenChange}
        title={title}
        hideTitle
        detents={[0.6]}
        testId={testId}
      >
        {head ? (
          head.href ? (
            <Link href={head.href} className="nf-asheet__head" data-testid={head["data-testid"]} onClick={close}>
              {headInner}
            </Link>
          ) : head.onSelect ? (
            <button
              type="button"
              className="nf-asheet__head"
              data-testid={head["data-testid"]}
              onClick={() => {
                head.onSelect?.();
                close();
              }}
            >
              {headInner}
            </button>
          ) : (
            <div className="nf-asheet__head" data-testid={head["data-testid"]}>
              {headInner}
            </div>
          )
        ) : null}

        {quick.length > 0 ? (
          <div
            className="nf-asheet__quick"
            data-few={quick.length < 3 ? "true" : undefined}
            data-testid={testId ? `${testId}-quick` : undefined}
          >
            {quick.slice(0, 4).map((action) => (
              <QuickItem key={action.key} action={action} onDone={close} />
            ))}
          </div>
        ) : null}

        <ListGroup className="nf-asheet__rows">
          {ordered.map((row) => (
            <ListRow
              key={row.key}
              className={row.danger ? "nf-asheet__row--danger" : undefined}
              data-testid={row["data-testid"]}
              leading={
                row.icon ? (
                  <IconPlate size="sm" shape="round" tone={row.danger ? "danger" : undefined}>
                    <UiIcon name={row.icon} size={18} />
                  </IconPlate>
                ) : undefined
              }
              title={row.label}
              sub={row.sub}
              trailing={row.trailing}
              chevron={row.chevron}
              href={row.href}
              onClick={
                row.disabled
                  ? undefined
                  : () => {
                      if (row.confirm) {
                        /* The question replaces this sheet rather than
                           stacking on it: two scrims over one decision. */
                        close();
                        setConfirming(row);
                        return;
                      }
                      row.onSelect?.();
                      if (!row.href) close();
                    }
              }
            />
          ))}
        </ListGroup>

        {doneLabel ? (
          <div className="nf-asheet__done">
            <Button variant="glass" size="lg" full onClick={close} data-testid={testId ? `${testId}-done` : undefined}>
              {doneLabel}
            </Button>
          </div>
        ) : null}
      </Sheet>

      {confirming?.confirm ? (
        <ConfirmSheet
          open
          onOpenChange={(next) => {
            if (!next) setConfirming(null);
          }}
          title={confirming.confirm.title}
          line={confirming.confirm.line}
          confirmLabel={confirming.confirm.confirmLabel}
          cancelLabel={confirming.confirm.cancelLabel}
          onConfirm={() => {
            const row = confirming;
            setConfirming(null);
            row.onSelect?.();
          }}
          testId={testId ? `${testId}-confirm` : "action-sheet-confirm"}
        />
      ) : null}
    </>
  );
}
