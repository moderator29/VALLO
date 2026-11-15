import type { Metadata } from "next";
import Link from "next/link";
import { requireConsole } from "@/lib/admin/guard";
import { PageHead } from "../../_components/panels";
import { PositionHandbookIndex, PositionHandbookView } from "./PositionHandbookView";

export const metadata: Metadata = { title: "Your handbook", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * YOUR OWN POSITION'S HANDBOOK, IN FULL (15 November 2026).
 *
 * This page used to print the job description for the position a staff member
 * holds. The job description is still all here, inside the handbook: the
 * handbook's first section draws its summary, who it reports to, its
 * responsibilities and what is expected, straight from `JOB_DESCRIPTIONS`, so
 * nothing was lost and there is no second copy to drift. The access email
 * still links here.
 *
 * An admin holds no named position, so they get the index of every handbook.
 * Under a person's own handbook, an admin also gets that index, because
 * reading another position's handbook is how the team understands each other.
 */
export default async function PositionPage() {
  const door = await requireConsole();
  if (door.state !== "console") {
    return (
      <div className="nf-console">
        <PageHead title="Your handbook" lede="This page is for Vallo staff." />
      </div>
    );
  }
  const own = door.staff.position;
  const everyPosition = door.staff.isAdmin || door.staff.isSuperAdmin;
  if (own) {
    return (
      <div data-testid="staff-position">
        <PositionHandbookView position={own} own canReadEveryPosition={everyPosition} />
        {everyPosition ? (
          <div className="nf-console mt-block">
            <PositionHandbookIndex />
          </div>
        ) : null}
      </div>
    );
  }
  return (
    <div className="nf-console" data-testid="staff-position">
      <PageHead
        title="Position handbooks"
        lede={
          everyPosition
            ? "Every named position, its handbook, the desks it opens and what is expected of the person in it."
            : "Your access was given by access area rather than a named position. These are the positions at Vallo, and each one's handbook."
        }
      />
      <p className="nf-body">
        Start with the{" "}
        <Link href="/admin/handbook" className="font-semibold text-[var(--nf-content-link)] underline underline-offset-2">
          staff handbook
        </Link>{" "}
        you acknowledge, then read the handbook for the work you do. Every named position has one below.
      </p>
      <PositionHandbookIndex heading={false} />
    </div>
  );
}
