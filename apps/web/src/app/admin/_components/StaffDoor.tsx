import Link from "next/link";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { panelClass } from "@/components/ui/Panel";
import "./admin-material.css";

/**
 * THE DOOR TO THE STAFF DESK (the founder, 12 November 2026: "add a button to
 * take me to where I can assign roles and add people as admin with their
 * positions").
 *
 * The desk already existed and did everything he asked for: `/admin/staff`
 * grants and revokes access, sets a position with its job description and
 * scopes, keeps the support team and the key roster. The console overview
 * simply had no way into it. The rail has one, which is why the page could
 * look finished while the thing he wanted was two taps away behind a menu.
 *
 * WHY IT IS NOT A TILE IN THE GRID ABOVE. `QueueFigures` states its own
 * contract at the top of its file: every tile is a desk with a count, each
 * count a database read, and the tiles must agree with the rail's badges
 * because they are the same reads. Staff access has no queue and no count. A
 * tile there would have to print a number it does not have, or a zero that
 * reads as "nothing waiting", which on a staff desk would be a lie about
 * access rather than a fact about a backlog. So it sits beside the grid as
 * what it is: a door, not a figure.
 *
 * It is drawn for every operator who reaches the overview. The desk itself
 * admits only the founder's super admin account and the database refuses a
 * grant from anybody else whatever this link does, so the honest refusal
 * every other desk gives is the right answer for somebody who taps it without
 * the scope, and hiding the door would instead leave them guessing where the
 * thing they were told about lives.
 */
export function StaffDoor() {
  return (
    <section aria-labelledby="ov-staff-title" className="nf-admin-figures">
      <h2 id="ov-staff-title" className="sr-only">
        Staff and roles
      </h2>
      <Link
        href="/admin/staff"
        data-testid="overview-staff-door"
        className={panelClass({ variant: "card", className: "nf-panel--figure nf-admin-figure nf-admin-figure--link nf-admin-door" })}
      >
        <span className="nf-admin-figure__top">
          <UiIcon name="user-check" size={20} className="nf-admin-figure__glyph" />
          <span className="nf-admin-figure__label">Staff and roles</span>
        </span>
        <span className="nf-admin-door__lede">
          Add somebody to the team, set their position and what it opens, and take access away.
        </span>
        <span className="nf-admin-figure__foot">
          <span className="nf-admin-door__go">Open the staff desk</span>
          <UiIcon name="chevron-right" size={16} className="nf-admin-figure__chev" />
        </span>
      </Link>
    </section>
  );
}
