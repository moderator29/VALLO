import type { Metadata } from "next";
import Link from "next/link";
import { STAFF_SCOPE_LABEL, requireConsole } from "@/lib/admin/guard";
import { JOB_DESCRIPTIONS, STAFF_POSITIONS, type JobDescription } from "@/lib/admin/staff-positions";
import { PageHead, Panel } from "../../_components/panels";

export const metadata: Metadata = { title: "Your role", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

function Description({ job }: { job: JobDescription }) {
  return (
    <>
      <Panel title="What the position is">
        <p className="nf-body">{job.summary}</p>
        <p className="nf-body mt-inline">Reports to: {job.reportsTo}.</p>
        <p className="nf-body mt-inline">Desks: {job.scopes.map((s) => STAFF_SCOPE_LABEL[s]).join(", ")}.</p>
      </Panel>
      <Panel title="What you are responsible for">
        <ul className="grid gap-xs">
          {job.responsibilities.map((point) => (
            <li key={point} className="nf-body">
              {point}
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="What is expected of you">
        <ul className="grid gap-xs">
          {job.expectations.map((point) => (
            <li key={point} className="nf-body">
              {point}
            </li>
          ))}
        </ul>
        <p className="nf-body mt-sm">
          File your weekly report every week. It opens on Saturday and is due Monday at 12:00, Lagos time.{" "}
          <Link href="/admin/manual/weekly-report" className="font-semibold text-[var(--nf-content-link)] underline underline-offset-2">
            How the weekly report works
          </Link>
          .
        </p>
      </Panel>
      <Panel title="When to escalate">
        <ul className="grid gap-xs">
          {job.escalate.map((point) => (
            <li key={point} className="nf-body">
              {point}
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}

/**
 * THE JOB DESCRIPTION FOR THE POSITION A STAFF MEMBER HOLDS, beside the
 * handbook, so they can always read back exactly what their role covers. The
 * access email links here. Admins, who hold no position, see every one.
 */
export default async function PositionPage() {
  const door = await requireConsole();
  if (door.state !== "console") {
    return (
      <div className="nf-console">
        <PageHead title="Your role" lede="This page is for Vallo staff." />
      </div>
    );
  }
  const own = door.staff.position;
  if (own) {
    const job = JOB_DESCRIPTIONS[own];
    return (
      <div className="nf-console" data-testid="staff-position">
        <PageHead title={job.title} lede="Your position at Vallo, and what it covers." />
        <Description job={job} />
      </div>
    );
  }
  const everyPosition = door.staff.isAdmin || door.staff.isSuperAdmin;
  return (
    <div className="nf-console" data-testid="staff-position">
      <PageHead
        title="Staff positions"
        lede={
          everyPosition
            ? "Every named position, the desks it opens by default, and what is expected of the person in it."
            : "Your access was given by access area rather than a named position. These are the positions at Vallo."
        }
      />
      {STAFF_POSITIONS.map((position) => (
        <section key={position} id={position} className="mt-block">
          <h2 className="nf-h3">{JOB_DESCRIPTIONS[position].title}</h2>
          <Description job={JOB_DESCRIPTIONS[position]} />
        </section>
      ))}
    </div>
  );
}
