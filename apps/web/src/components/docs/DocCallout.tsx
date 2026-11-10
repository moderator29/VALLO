import type { ReactNode } from "react";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import "./docs-kit.css";

/**
 * A CALLOUT: three kinds, each with its own glyph and a title that says the
 * kind in words, so the meaning never rides on colour alone.
 *
 *   note      something worth knowing
 *   warning   something that costs the reader if they skip it
 *   not-live  a thing described here that is not available yet. Money pages
 *             use this for anything that is coming and not here: it is the
 *             honest form of "coming soon".
 */
export type DocCalloutKind = "note" | "warning" | "not-live";

const KIND: Record<DocCalloutKind, { icon: UiIconName; label: string }> = {
  note: { icon: "info", label: "Note" },
  warning: { icon: "alert-triangle", label: "Take care" },
  "not-live": { icon: "clock", label: "Not available yet" },
};

export function DocCallout({
  kind = "note",
  title,
  children,
}: {
  kind?: DocCalloutKind;
  /** Replaces the kind's default title. */
  title?: string;
  children: ReactNode;
}) {
  const k = KIND[kind];
  return (
    <aside className="nf-dk-callout" data-kind={kind} role="note" aria-label={title ?? k.label}>
      <UiIcon name={k.icon} size={20} />
      <div>
        <p className="nf-dk-callout__title">{title ?? k.label}</p>
        <div className="nf-dk-callout__body">{children}</div>
      </div>
    </aside>
  );
}
