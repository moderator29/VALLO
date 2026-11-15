"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { IconPlate } from "@/components/ui/IconPlate";
import { Sheet } from "@/components/ui/Sheet";
import { Switch } from "@/components/ui/Switch";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { useClientMount } from "@/lib/ui/client-mount";
import { useOverlay } from "@/lib/ui/use-overlay";
import {
  ACTION_SHEET_QUICK_MAX,
  groupRows,
  orderRows,
  placePopover,
  type ActionSheetActionRow,
  type ActionSheetDangerRow,
  type ActionSheetHeader,
  type ActionSheetProps,
  type ActionSheetQuick,
  type ActionSheetRadioRow,
  type ActionSheetRow,
  type ActionSheetSwitchRow,
} from "./action-sheet-model";
import "./action-sheet.css";

export type {
  ActionSheetActionRow,
  ActionSheetConfirm,
  ActionSheetDangerRow,
  ActionSheetHeader,
  ActionSheetProps,
  ActionSheetQuick,
  ActionSheetRadioRow,
  ActionSheetRow,
  ActionSheetSwitchRow,
} from "./action-sheet-model";

/**
 * THE ACTION SHEET: what can be done with one thing, in two cards and a Done
 * bar (handoff 6.3).
 *
 *  - THE HEADER CARD says what the sheet is about (a face or a photograph, a
 *    name, one line under it, and a chevron when it opens) and carries up to
 *    four round quick actions with a word under each.
 *  - THE ROWS CARD holds everything else: a plain action, a row that opens
 *    something (a chevron), a row with a second line, a row that ends in a
 *    switch or a radio, and the destructive rows, which are always last and
 *    always behind a confirm.
 *  - THE DONE BAR is its own full-width button under both.
 *
 * It is the platform's `Sheet`, so the swipe down, the scrim, Escape, Back,
 * the focus trap and the focus return are the ones every sheet has, and a
 * hand-rolled overlay stays refused (`hand-rolled-sheets.test.ts`). Under
 * reduced motion it fades instead of sliding (action-sheet.css).
 *
 * ON A WIDE SCREEN WITH A MOUSE the same content is a popover hung from the
 * control that opened it (`anchor`), not a sheet stretched across a monitor:
 * no scrim, no Done bar, a press outside or Escape closes it, Tab stays
 * inside and focus goes back to the control. With no `anchor` (a long press
 * has none) the wide screen gets the sheet's own centred dialog.
 *
 * A destructive row cannot be built without saying how it is confirmed:
 * `confirm` is either the words for the shared `ConfirmSheet`, or `"own"`
 * when the caller already asks in a sheet of its own (a report form, a block
 * that explains itself). Choosing an action closes the sheet; a switch or a
 * radio changes in place and leaves it open.
 */

const WIDE = "(min-width: 64rem) and (pointer: fine)";

function subscribeWide(notify: () => void): () => void {
  const query = window.matchMedia?.(WIDE);
  if (!query) return () => {};
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
}

/** A wide screen driven by a mouse: where a sheet becomes a popover. False on the server. */
function useWidePointer(): boolean {
  return useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia?.(WIDE).matches ?? false,
    () => false,
  );
}

export function ActionSheet({
  open,
  onOpenChange,
  title,
  header,
  quick = [],
  rows = [],
  doneLabel = "Done",
  anchor,
  testId = "action-sheet",
}: ActionSheetProps) {
  const wide = useWidePointer();
  const popover = wide && anchor != null;
  /* The row being confirmed, and its words kept while the confirm leaves. */
  const [confirm, setConfirm] = useState<{ row: ActionSheetDangerRow; open: boolean } | null>(null);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  const choose = useCallback(
    (row: ActionSheetActionRow | ActionSheetDangerRow) => {
      if (row.kind === "danger") {
        onOpenChange(false);
        if (row.confirm === "own") row.onSelect();
        else setConfirm({ row, open: true });
        return;
      }
      if (!row.keepOpen) onOpenChange(false);
      row.onSelect?.();
    },
    [onOpenChange],
  );

  const body = (
    <ActionSheetBody
      header={header}
      quick={quick}
      rows={rows}
      onClose={close}
      onChoose={choose}
      testId={testId}
    />
  );

  const words = confirm && confirm.row.confirm !== "own" ? confirm.row.confirm : null;

  return (
    <>
      {popover ? (
        <ActionPopover open={open} onClose={close} anchor={anchor} title={title} testId={testId}>
          {body}
        </ActionPopover>
      ) : (
        <Sheet
          open={open}
          onOpenChange={onOpenChange}
          title={title}
          hideTitle
          closeLabel={null}
          className="nf-acts-sheet"
          testId={testId}
          footer={
            <Button variant="secondary" size="lg" full onClick={close} data-testid={`${testId}-done`}>
              {doneLabel}
            </Button>
          }
        >
          {body}
        </Sheet>
      )}
      {confirm && words ? (
        <ConfirmSheet
          open={confirm.open}
          onOpenChange={(next) => {
            if (!next) setConfirm((current) => (current ? { ...current, open: false } : current));
          }}
          title={words.title}
          line={words.line}
          confirmLabel={words.confirmLabel}
          cancelLabel={words.cancelLabel ?? "Cancel"}
          onConfirm={() => {
            setConfirm((current) => (current ? { ...current, open: false } : current));
            confirm.row.onSelect();
          }}
          testId={`${testId}-confirm`}
        />
      ) : null}
    </>
  );
}

function ActionSheetBody({
  header,
  quick,
  rows,
  onClose,
  onChoose,
  testId,
}: {
  header: ActionSheetHeader | undefined;
  quick: readonly ActionSheetQuick[];
  rows: readonly ActionSheetRow[];
  onClose: () => void;
  onChoose: (row: ActionSheetActionRow | ActionSheetDangerRow) => void;
  testId: string;
}) {
  const shownQuick = quick.slice(0, ACTION_SHEET_QUICK_MAX);
  const grouped = useMemo(() => groupRows(orderRows(rows)), [rows]);

  return (
    <div className="nf-acts">
      {header || shownQuick.length > 0 ? (
        <section className="nf-acts__card" data-testid={`${testId}-head`}>
          {header ? <HeaderCard header={header} onClose={onClose} /> : null}
          {shownQuick.length > 0 ? (
            <ul className="nf-acts__quick" role="list" data-divided={header ? "true" : undefined}>
              {shownQuick.map((action) => (
                <li key={action.id} className="nf-acts__quick-item">
                  <QuickAction action={action} onClose={onClose} />
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
      {grouped.length > 0 ? (
        <ul className="nf-acts__card nf-acts__rows" role="list" data-testid={`${testId}-rows`}>
          {grouped.map((entry) =>
            Array.isArray(entry) ? (
              <li key={`group-${entry[0]?.id}`} className="nf-acts__li">
                <RadioGroup rows={entry} />
              </li>
            ) : (
              <li key={entry.id} className="nf-acts__li">
                {entry.kind === "switch" ? (
                  <SwitchRow row={entry} />
                ) : entry.kind === "radio" ? null : (
                  <ChoiceRow row={entry} onChoose={onChoose} onClose={onClose} />
                )}
              </li>
            ),
          )}
        </ul>
      ) : null}
    </div>
  );
}

function HeaderCard({ header, onClose }: { header: ActionSheetHeader; onClose: () => void }) {
  const opens = Boolean(header.href || header.onOpen);
  const inner = (
    <>
      {header.media != null ? <span className="nf-acts__media">{header.media}</span> : null}
      <span className="nf-acts__head-text">
        <span className="nf-acts__head-title">{header.title}</span>
        {header.subtitle ? <span className="nf-acts__head-sub">{header.subtitle}</span> : null}
      </span>
      {opens ? <UiIcon name="chevron-right" size={20} className="nf-acts__chevron" /> : null}
    </>
  );
  if (header.href) {
    return (
      <Link href={header.href} className="nf-acts__head" onClick={onClose} data-testid={header.testId}>
        {inner}
      </Link>
    );
  }
  if (header.onOpen) {
    const open = header.onOpen;
    return (
      <button
        type="button"
        className="nf-acts__head"
        onClick={() => {
          onClose();
          open();
        }}
        data-testid={header.testId}
      >
        {inner}
      </button>
    );
  }
  return (
    <div className="nf-acts__head" data-testid={header.testId}>
      {inner}
    </div>
  );
}

function QuickAction({ action, onClose }: { action: ActionSheetQuick; onClose: () => void }) {
  const inner = (
    <>
      <IconPlate size="md" shape="round" tone={action.active ? "brand" : "neutral"}>
        <UiIcon name={action.icon} size={20} filled={action.active} />
      </IconPlate>
      <span className="nf-acts__quick-label">{action.label}</span>
    </>
  );
  if (action.href && !action.disabled) {
    return (
      <Link href={action.href} className="nf-acts__quick-btn" onClick={onClose} data-testid={action.testId}>
        {inner}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className="nf-acts__quick-btn"
      aria-pressed={action.active === undefined ? undefined : action.active}
      disabled={action.disabled}
      onClick={() => {
        if (!action.keepOpen) onClose();
        action.onSelect?.();
      }}
      data-testid={action.testId}
    >
      {inner}
    </button>
  );
}

function RowText({ row, labelId }: { row: { label: string; hint?: string }; labelId?: string }) {
  return (
    <span className="nf-acts__text">
      <span className="nf-acts__label" id={labelId}>
        {row.label}
      </span>
      {row.hint ? <span className="nf-acts__hint">{row.hint}</span> : null}
    </span>
  );
}

function RowIcon({ icon }: { icon: UiIconName | undefined }) {
  return icon ? (
    <span className="nf-acts__icon" aria-hidden="true">
      <UiIcon name={icon} size={20} />
    </span>
  ) : null;
}

function ChoiceRow({
  row,
  onChoose,
  onClose,
}: {
  row: ActionSheetActionRow | ActionSheetDangerRow;
  onChoose: (row: ActionSheetActionRow | ActionSheetDangerRow) => void;
  onClose: () => void;
}) {
  const danger = row.kind === "danger";
  const href = !danger && !row.disabled ? row.href : undefined;
  const value = !danger ? row.value : undefined;
  const chevron = !danger && (row.chevron || Boolean(row.href));
  const inner = (
    <>
      <RowIcon icon={row.icon} />
      <RowText row={row} />
      {value ? <span className="nf-acts__value">{value}</span> : null}
      {chevron ? <UiIcon name="chevron-right" size={20} className="nf-acts__chevron" /> : null}
    </>
  );
  if (href) {
    return (
      <Link href={href} className="nf-acts__row" onClick={onClose} data-testid={row.testId}>
        {inner}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className="nf-acts__row"
      data-danger={danger ? "true" : undefined}
      disabled={row.disabled}
      onClick={() => onChoose(row)}
      data-testid={row.testId}
    >
      {inner}
    </button>
  );
}

function SwitchRow({ row }: { row: ActionSheetSwitchRow }) {
  const labelId = useId();
  /* A label, so a press anywhere on the row turns the switch, and the switch
     is named by the words beside it. */
  return (
    <label className="nf-acts__row nf-acts__row--control" data-disabled={row.disabled ? "true" : undefined}>
      <RowIcon icon={row.icon} />
      <RowText row={row} labelId={labelId} />
      <Switch
        checked={row.checked}
        onCheckedChange={row.onChange}
        disabled={row.disabled}
        aria-labelledby={labelId}
        data-testid={row.testId}
      />
    </label>
  );
}

function RadioGroup({ rows }: { rows: ActionSheetRadioRow[] }) {
  const group = rows[0]?.group ?? "";
  const anyChecked = rows.some((row) => row.checked);
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) return;
    const radios = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]:not(:disabled)')];
    const at = radios.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0 || radios.length === 0) return;
    event.preventDefault();
    const next = radios[(at + step + radios.length) % radios.length];
    next?.focus();
    next?.click();
  }
  return (
    <div role="radiogroup" aria-label={group} className="nf-acts__group" onKeyDown={onKeyDown}>
      {rows.map((row, index) => (
        <button
          key={row.id}
          type="button"
          role="radio"
          aria-checked={row.checked}
          /* One stop in the tab order; the arrows reach the others. */
          tabIndex={row.checked || (!anyChecked && index === 0) ? 0 : -1}
          className="nf-acts__row nf-acts__row--radio"
          disabled={row.disabled}
          onClick={() => {
            if (!row.checked) row.onSelect();
          }}
          data-testid={row.testId}
        >
          <RowIcon icon={row.icon} />
          <RowText row={row} />
          <span className="nf-acts__radio" data-checked={row.checked ? "true" : undefined} aria-hidden="true">
            {row.checked ? <UiIcon name="check" size={16} /> : null}
          </span>
        </button>
      ))}
    </div>
  );
}

function ActionPopover({
  open,
  onClose,
  anchor,
  title,
  testId,
  children,
}: {
  open: boolean;
  onClose: () => void;
  anchor: RefObject<HTMLElement | null>;
  title: string;
  testId: string;
  children: ReactNode;
}) {
  const mounted = useClientMount();
  const panelRef = useRef<HTMLDivElement | null>(null);

  /* Escape, Back, the Tab trap, the scroll lock and the focus return to the
     trigger: the one shared implementation. It draws no scrim. */
  useOverlay({ open: open && mounted, onClose, panelRef });

  /* Placed before paint, and again when the window changes size. Written
     straight onto the node as two custom properties, so placing it is not a
     render. */
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const trigger = anchor.current;
    if (!open || !panel || !trigger) return;
    const place = () => {
      const box = panel.getBoundingClientRect();
      const at = placePopover(
        trigger.getBoundingClientRect(),
        { width: box.width, height: box.height },
        { width: document.documentElement.clientWidth, height: window.innerHeight },
        getComputedStyle(panel).direction === "rtl",
      );
      panel.style.setProperty("--nf-acts-x", `${Math.round(at.left)}px`);
      panel.style.setProperty("--nf-acts-y", `${Math.round(at.top)}px`);
      panel.dataset.above = at.above ? "true" : "false";
      panel.dataset.placed = "true";
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open, mounted, anchor]);

  /* A press anywhere else closes it. The trigger is left to its own click,
     which already toggles. */
  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target || panelRef.current?.contains(target) || anchor.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open, onClose, anchor]);

  if (!mounted || !open) return null;
  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      tabIndex={-1}
      className="nf-acts-pop outline-none"
      data-testid={testId}
    >
      {children}
    </div>,
    document.body,
  );
}
