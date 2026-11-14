import Link from "next/link";
import { STAFF_SCOPE_LABEL, type StaffAccess } from "@/lib/admin/guard";
import { JOB_DESCRIPTIONS } from "@/lib/admin/staff-positions";
import { POSITION_GUIDE, STAFF_DESK, STAFF_EXTRA_DESKS } from "./StaffFrame";

/**
 * YOUR DESKS: the desks a person's position opens, as the first thing on the
 * console's front page. The operator's menu holds every desk on the console,
 * and somebody who was given a named position has two or three of them to
 * find. This draws those, by name, with the manual chapter written for the
 * position where there is one.
 */

export function yourDesks(staff: Pick<StaffAccess, "scopes">): { href: string; label: string }[] {
  const seen = new Set<string>();
  const desks: { href: string; label: string }[] = [];
  for (const scope of staff.scopes) {
    for (const desk of [{ href: STAFF_DESK[scope], label: STAFF_SCOPE_LABEL[scope] }, ...(STAFF_EXTRA_DESKS[scope] ?? [])]) {
      if (seen.has(desk.href)) continue;
      seen.add(desk.href);
      desks.push(desk);
    }
  }
  return desks;
}

export function YourDesks({ staff }: { staff: Pick<StaffAccess, "scopes" | "position"> }) {
  const desks = yourDesks(staff);
  if (desks.length === 0) return null;
  const manual = staff.position ? POSITION_GUIDE[staff.position] : undefined;
  return (
    <section className="nf-panel nf-panel--card block p-card" aria-labelledby="your-desks-title" data-testid="your-desks">
      <h2 className="nf-admin-panel__title" id="your-desks-title">
        Your desks{staff.position ? `: ${JOB_DESCRIPTIONS[staff.position].title}` : ""}
      </h2>
      <ul className="nf-your-desks mt-inline list-none p-0">
        {desks.map((desk) => (
          <li key={desk.href}>
            <Link href={desk.href} className="nf-your-desks__desk">
              <span className="nf-your-desks__name">{desk.label}</span>
              <span className="nf-your-desks__what">Open this desk</span>
            </Link>
          </li>
        ))}
        <li>
          <Link href="/admin/my-desk" className="nf-your-desks__desk">
            <span className="nf-your-desks__name">My desk</span>
            <span className="nf-your-desks__what">Your tasks, announcements and weekly report</span>
          </Link>
        </li>
        {manual ? (
          <li>
            <Link href={`/admin/manual/${manual}`} className="nf-your-desks__desk">
              <span className="nf-your-desks__name">How to do this job on the console</span>
              <span className="nf-your-desks__what">The step by step guide written for your position</span>
            </Link>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
