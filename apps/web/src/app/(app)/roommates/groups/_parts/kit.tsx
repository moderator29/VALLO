import type { ReactNode } from "react";
import Link from "next/link";

import { FaceStack as KitFaceStack, PersonFace } from "@/components/roommates/Marks";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import type { PersonRef } from "@/lib/features/roommates/model";

/**
 * THE SMALL SHARED MARKS OF THE HUB, THE GROUPS, THE SPLITTER AND THE CHECKS
 * (FE-B). Server-safe: no state. Faces come from FE-A's visual kit
 * (`components/roommates`); the section, the empty card, the plate and the
 * tag are this folder's own (`nf-rmb-`), in the shape the Circle pages use.
 */

/** A member's own photograph, or their initial on the brand ink: FE-A's kit face. */
export function Face({ person, size = "md" }: { person: Pick<PersonRef, "name" | "avatarUrl"> | null; size?: "sm" | "md" | "lg" }) {
  return <PersonFace person={person} size={size} />;
}

/** Up to five real faces, overlapping, for a group: FE-A's kit stack. */
export function FaceStack({ people, size = "sm", max = 5 }: { people: Pick<PersonRef, "userId" | "name" | "avatarUrl">[]; size?: "sm" | "md"; max?: number }) {
  return <KitFaceStack people={people} size={size} max={max} />;
}

export function Plate({ icon }: { icon: UiIconName }) {
  return (
    <span className="nf-rmb-plate" aria-hidden="true">
      <UiIcon name={icon} size={20} />
    </span>
  );
}

export function Section({ title, id, action, children }: { title: string; id?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="nf-rmb-section" aria-labelledby={id}>
      <div className="nf-rmb-section__head">
        <h2 id={id} className="nf-rmb-section__title">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** An honest empty: what is true now, and the one next step. */
export function Empty({ children, href, label }: { children: ReactNode; href?: string; label?: string }) {
  return (
    <div className="nf-rmb-empty">
      <p>{children}</p>
      {href && label ? (
        <Link href={href} className="nf-link">
          {label}
        </Link>
      ) : null}
    </div>
  );
}

export function Tag({ tone = "brand", children }: { tone?: "brand" | "good" | "quiet" | "warn" | "bad"; children: ReactNode }) {
  return (
    <span className="nf-rmb-tag" data-tone={tone}>
      {children}
    </span>
  );
}

/** Fill `{name}`-style holes in a sentence from the dictionary. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in values ? String(values[key]) : whole));
}
