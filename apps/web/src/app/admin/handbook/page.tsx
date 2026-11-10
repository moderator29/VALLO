import type { Metadata } from "next";
import { requireConsole } from "@/lib/admin/guard";
import { STAFF_HANDBOOK, STAFF_HANDBOOK_VERSION } from "@/lib/admin/staff-handbook";
import { PageHead, Panel } from "../_components/panels";
import { AcknowledgeHandbook } from "./AcknowledgeHandbook";
import Link from "next/link";
import { JOB_DESCRIPTIONS } from "@/lib/admin/staff-positions";

export const metadata: Metadata = { title: "Staff handbook", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * TRACK K: THE HANDBOOK EVERY STAFF MEMBER ACKNOWLEDGES BEFORE ANY DESK
 * UNLOCKS. Admins may read and acknowledge it too; for a staff member the
 * acknowledgement is what `private.staff_can` checks.
 */
export default async function HandbookPage() {
  const door = await requireConsole();
  if (door.state !== "console") {
    return (
      <div className="nf-console">
        <PageHead title="Staff handbook" lede="This page is for Vallo staff." />
      </div>
    );
  }
  return (
    <div className="nf-console" data-testid="staff-handbook">
      <PageHead
        title="Staff handbook"
        lede={`Version ${STAFF_HANDBOOK_VERSION}. Read all of it. Your desks unlock when you acknowledge it, and you will be asked again whenever it changes.`}
      />
      {STAFF_HANDBOOK.map((section) => (
        <Panel key={section.heading} title={section.heading}>
          <ul className="grid gap-xs">
            {section.points.map((point) => (
              <li key={point} className="nf-body">
                {point}
              </li>
            ))}
          </ul>
        </Panel>
      ))}
      <Panel title="The staff manual">
        <p className="nf-body">
          What each desk is for and how to work it.{" "}
          <Link href="/admin/handbook/manual" className="font-semibold text-[var(--nf-content-link)] hover:underline">
            Open the staff manual
          </Link>
          .
        </p>
      </Panel>
      <Panel title="Your role">
        <p className="nf-body">
          {door.staff.position
            ? `You hold the position of ${JOB_DESCRIPTIONS[door.staff.position].title}. ${JOB_DESCRIPTIONS[door.staff.position].summary}`
            : "Your access was given by access area rather than a named position."}{" "}
          <Link href="/admin/handbook/position" className="font-semibold text-[var(--nf-content-link)] hover:underline">
            {door.staff.position ? "Read your full role description" : "Read the role descriptions"}
          </Link>
          .
        </p>
      </Panel>
      <Panel title="Acknowledge">
        {door.staff.handbookAcknowledged ? (
          <p className="nf-body" data-testid="handbook-acknowledged">
            You acknowledged this version. Your desks are open.
          </p>
        ) : (
          <AcknowledgeHandbook version={STAFF_HANDBOOK_VERSION} />
        )}
      </Panel>
    </div>
  );
}
