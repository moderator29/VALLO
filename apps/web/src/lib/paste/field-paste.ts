import type { ClipboardEvent } from "react";

import { cleanPastedEmail, cleanPastedPhone } from "./paste";

/**
 * PASTE CLEANS WHAT IT SHOULD, IN THE FIELD ITSELF (founder, 14 November 2026).
 *
 * A phone number copied from a contact card arrives as "+234 (803) 123-4567"
 * and an email from a signature as "Seyi <Seyi@Example.com> ". Both are right
 * and both are refused by a form that wanted digits or a bare address. The
 * field cleans the paste as it lands, so what the person sees is what will be
 * sent. Typing is never touched: this runs on a paste and nothing else.
 */
export type CleanKind = "tel" | "email";

/** Which cleaning a field's own attributes ask for, or null for none. */
export function cleanKindFor(field: { type?: string | undefined; inputMode?: string | undefined; autoComplete?: string | undefined }): CleanKind | null {
  if (field.type === "tel" || field.inputMode === "tel" || (field.autoComplete ?? "").startsWith("tel")) return "tel";
  if (field.type === "email" || field.inputMode === "email" || field.autoComplete === "email") return "email";
  return null;
}

export function cleanPasted(kind: CleanKind, text: string): string {
  return kind === "tel" ? cleanPastedPhone(text) : cleanPastedEmail(text);
}

/**
 * Write a value into a field the way typing does, so a controlled React field
 * hears it: the element's own setter, then a real `input` event.
 */
export function setFieldValue(field: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) setter.call(field, value);
  else field.value = value;
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

/** What the field holds once `inserted` replaces the selection (`start` to `end`). */
export function spliceText(current: string, inserted: string, start: number | null, end: number | null): string {
  const from = start ?? current.length;
  const to = end ?? from;
  return `${current.slice(0, from)}${inserted}${current.slice(to)}`;
}

/**
 * The `onPaste` for a phone or email field. Leaves the paste alone when it is
 * already clean, so the browser's own paste (and its undo) is untouched.
 */
export function cleanOnPaste(event: ClipboardEvent<HTMLInputElement>, kind: CleanKind): void {
  const text = event.clipboardData?.getData("text/plain") ?? "";
  if (!text) return;
  const cleaned = cleanPasted(kind, text);
  if (cleaned === text || cleaned.length === 0) return;
  const field = event.currentTarget;
  let start: number | null = null;
  let end: number | null = null;
  try {
    /* An email field has no selection to read; a paste there goes at the end
       of what it holds, which is the whole field when it was empty. */
    start = field.selectionStart;
    end = field.selectionEnd;
  } catch {
    start = null;
    end = null;
  }
  event.preventDefault();
  const next = spliceText(field.value, cleaned, start, end);
  setFieldValue(field, field.maxLength > 0 ? next.slice(0, field.maxLength) : next);
}
