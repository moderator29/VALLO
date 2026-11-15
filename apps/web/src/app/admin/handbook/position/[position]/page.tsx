import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireConsole } from "@/lib/admin/guard";
import { isStaffPosition, JOB_DESCRIPTIONS } from "@/lib/admin/staff-positions";
import { PageHead } from "../../../_components/panels";
import { PositionHandbookView } from "../PositionHandbookView";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ position: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { position } = await params;
  const title = isStaffPosition(position) ? `${JOB_DESCRIPTIONS[position].title}: handbook` : "Position handbook";
  return { title, robots: { index: false, follow: false } };
}

/**
 * ONE POSITION'S HANDBOOK, BY NAME.
 *
 * Behind `requireConsole()`: a staff member may always read their own, and
 * anybody with console access may read any other position's too, because that
 * is how the team understands each other. The page says at the top which
 * position it is for, and whether it is the reader's own. It opens no desk and
 * reads no member data, so nothing here widens anybody's access.
 *
 * An unknown position is the ordinary 404 rather than an empty page with a
 * heading on it. `params` is a promise in this version of Next, so it is
 * awaited before it is read.
 */
export default async function PositionHandbookPage({ params }: Params) {
  const { position } = await params;
  if (!isStaffPosition(position)) notFound();
  const door = await requireConsole();
  if (door.state !== "console") {
    return (
      <div className="nf-console">
        <PageHead title="Position handbook" lede="This page is for Vallo staff." />
      </div>
    );
  }
  return (
    <div data-testid="staff-position-handbook">
      <PositionHandbookView
        position={position}
        own={door.staff.position === position}
        canReadEveryPosition={door.staff.isAdmin || door.staff.isSuperAdmin}
      />
    </div>
  );
}
