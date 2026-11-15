import type { ReactNode, RefObject } from "react";
import type { UiIconName } from "@/design-system/icons/UiIcon";

/**
 * The action sheet's types and arithmetic (components/ui/ActionSheet.tsx),
 * kept apart from the component so the unit suite, which runs in Node, can
 * read them.
 */

export type ActionSheetHeader = {
  title: string;
  /** One line under the name. */
  subtitle?: string;
  /** An avatar or a thumbnail, already drawn by the caller. */
  media?: ReactNode;
  /** Where the thing itself opens. With it (or `onOpen`) the card is one control with a chevron. */
  href?: string;
  onOpen?: () => void;
  testId?: string;
};

export type ActionSheetQuick = {
  id: string;
  label: string;
  icon: UiIconName;
  onSelect?: () => void;
  href?: string;
  /** A toggle that is on (Saved, Pinned): the plate is lit and the button says pressed. */
  active?: boolean;
  disabled?: boolean;
  /** Leave the sheet open after the press, for a toggle whose new state should be seen. */
  keepOpen?: boolean;
  testId?: string;
};

export type ActionSheetConfirm = {
  title: string;
  line: string;
  confirmLabel: string;
  cancelLabel?: string;
};

type RowBase = {
  id: string;
  label: string;
  /** A second line under the label. */
  hint?: string;
  icon?: UiIconName;
  disabled?: boolean;
  testId?: string;
};

export type ActionSheetActionRow = RowBase & {
  kind?: "action";
  onSelect?: () => void;
  href?: string;
  /** Draw the chevron: the row opens another sheet or a page. A link always has one. */
  chevron?: boolean;
  /** A short value at the end of the row ("8 hours"). */
  value?: string;
  /** Leave the sheet open after the press. */
  keepOpen?: boolean;
};

export type ActionSheetDangerRow = RowBase & {
  kind: "danger";
  onSelect: () => void;
  /**
   * How the act is confirmed, and it has to be said. The words for the shared
   * `ConfirmSheet`, or `"own"` when `onSelect` opens the caller's own confirm.
   */
  confirm: ActionSheetConfirm | "own";
};

export type ActionSheetSwitchRow = RowBase & {
  kind: "switch";
  checked: boolean;
  onChange: (next: boolean) => void;
};

export type ActionSheetRadioRow = RowBase & {
  kind: "radio";
  /** The name of the set this choice belongs to; neighbours with the same name are one group. */
  group: string;
  checked: boolean;
  onSelect: () => void;
};

export type ActionSheetRow = ActionSheetActionRow | ActionSheetDangerRow | ActionSheetSwitchRow | ActionSheetRadioRow;

export type ActionSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The accessible name: what these actions are for ("Actions for Ada"). */
  title: string;
  header?: ActionSheetHeader;
  /** Up to four; a fifth is not drawn. */
  quick?: readonly ActionSheetQuick[];
  rows?: readonly ActionSheetRow[];
  doneLabel?: string;
  /** The control that opened it. On a wide screen with a mouse the sheet becomes a popover hung from it. */
  anchor?: RefObject<HTMLElement | null>;
  testId?: string;
};

/** The most quick actions a header card holds. */
export const ACTION_SHEET_QUICK_MAX = 4;

/** Destructive rows last, everything else in the order given. */
export function orderRows(rows: readonly ActionSheetRow[]): ActionSheetRow[] {
  return [...rows.filter((row) => row.kind !== "danger"), ...rows.filter((row) => row.kind === "danger")];
}

/** Neighbouring radio rows of one group become one radiogroup; every other row stands alone. */
export function groupRows(rows: readonly ActionSheetRow[]): (ActionSheetRow | ActionSheetRadioRow[])[] {
  const out: (ActionSheetRow | ActionSheetRadioRow[])[] = [];
  for (const row of rows) {
    const last = out[out.length - 1];
    if (row.kind === "radio" && Array.isArray(last) && last[0]?.group === row.group) last.push(row);
    else out.push(row.kind === "radio" ? [row] : row);
  }
  return out;
}

/** The gap kept between the popover and the edge of the window, and between it and its trigger. */
const POPOVER_MARGIN = 8;

/**
 * Where a popover of this size hangs from this trigger: under it, start edges
 * aligned; flipped above when there is no room below and more above; slid back
 * inside the margin on either axis.
 */
export function placePopover(
  anchor: { left: number; right: number; top: number; bottom: number },
  size: { width: number; height: number },
  viewport: { width: number; height: number },
  rtl = false,
  margin = POPOVER_MARGIN,
): { left: number; top: number; above: boolean } {
  let left = rtl ? anchor.right - size.width : anchor.left;
  if (left + size.width > viewport.width - margin) left = rtl ? viewport.width - margin - size.width : anchor.right - size.width;
  left = Math.max(margin, Math.min(left, viewport.width - margin - size.width));
  const below = viewport.height - anchor.bottom - margin * 2;
  const over = anchor.top - margin * 2;
  const above = size.height > below && over > below;
  let top = above ? anchor.top - margin - size.height : anchor.bottom + margin;
  top = Math.max(margin, Math.min(top, viewport.height - margin - size.height));
  return { left, top, above };
}

