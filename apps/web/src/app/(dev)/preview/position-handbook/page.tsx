import Link from "next/link";
import { PositionHandbookIndex, PositionHandbookView } from "@/app/admin/handbook/position/PositionHandbookView";
import { POSITION_HANDBOOK_INDEX } from "@/lib/admin/position-handbook";
import { isStaffPosition, STAFF_POSITIONS, type StaffPosition } from "@/lib/admin/staff-positions";

/**
 * THE POSITION HANDBOOKS, ON THEIR REAL SCREENS, WITH NO CONSOLE DOOR.
 *
 * The real `PositionHandbookView` and `PositionHandbookIndex`, so the look,
 * the print stylesheet and both save controls are seen exactly as a staff
 * member sees them. Nothing is read from the database, because a handbook
 * reads nothing: it is the handbook data and the documentation kit.
 *
 *   ?position=moderator        one position's handbook (the default)
 *   ?position=ceo              another, to see a long desk table
 *   ?own=no                    as somebody reading a position that is not theirs
 *   ?screen=index              the index of every handbook
 *
 * "Save as PDF" opens the browser's own print view; "Save as a file"
 * downloads the Markdown. Both work here, because neither needs a server.
 */
export const dynamic = "force-dynamic";

export default async function PreviewPositionHandbook({
  searchParams,
}: {
  searchParams: Promise<{ position?: string; own?: string; screen?: string }>;
}) {
  const asked = await searchParams;
  const position: StaffPosition = isStaffPosition(asked.position) ? asked.position : "moderator";
  const own = asked.own !== "no";
  if (asked.screen === "index") {
    return (
      <div className="nf-console">
        <PositionHandbookIndex />
      </div>
    );
  }
  return (
    <div>
      <nav aria-label="Positions" className="nf-console grid gap-xs">
        <p className="nf-body-sm">
          {STAFF_POSITIONS.map((candidate) => (
            <span key={candidate}>
              <Link
                href={`/preview/position-handbook?position=${candidate}`}
                className="font-semibold text-[var(--nf-content-link)] underline underline-offset-2"
              >
                {POSITION_HANDBOOK_INDEX.find((entry) => entry.position === candidate)?.title ?? candidate}
              </Link>{" "}
            </span>
          ))}
          <Link
            href="/preview/position-handbook?screen=index"
            className="font-semibold text-[var(--nf-content-link)] underline underline-offset-2"
          >
            The index
          </Link>
        </p>
      </nav>
      <PositionHandbookView position={position} own={own} canReadEveryPosition />
    </div>
  );
}
