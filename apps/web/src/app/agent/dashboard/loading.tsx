import { Skeleton } from "@/components/ui/Skeleton";
import { AgentScreenSkeleton, AgentTitleSkeleton } from "@/components/agent/AgentScreenSkeleton";
import { PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * The wait, on the agent dashboard.
 *
 * This screen awaits the agent's profile, their listing counts, their bookings
 * and an earnings series before it renders anything: it is the heaviest read in
 * Agent Mode, and it is the landing screen after a sign-in, so it is the first
 * thing a new agent experiences.
 *
 * IT WAS RESERVING A SCREEN THAT NO LONGER EXISTS.
 *
 * `RealDashboard` was rebuilt from eleven surfaces to four. It is now a run of
 * labelled sections, each one a single grouped surface of rows: the numbers are
 * five rows, the listing breakdown is rows, the stays are rows, the quick
 * actions are rows. This file still reserved the shape it replaced, five stat
 * cards in a two/three/five column wall and two side-by-side panel cards at
 * 1.6fr / 1fr.
 *
 * So the wait drew seven bordered boxes in a grid and the screen then dissolved
 * them into four columns of rows, which is a layout shift dressed as a
 * transition and the exact fault the notifications skeleton had. The whole
 * point of reserving space is that nothing moves when the data lands; a
 * skeleton that reserves the wrong space is worse than none, because it teaches
 * the eye a shape and then corrects it.
 *
 * It reserves the real one now: a section label, then a grouped surface of
 * rows, twice, at the row heights `nf-row` actually draws.
 */

/** One labelled group of rows, which is what every section on this screen is. */
function GroupSkeleton({ rows }: { rows: number }) {
  return (
    <section>
      <Skeleton width="7rem" height="0.90625rem" radius="sm" />
      <div className="nf-panel nf-panel--card block mt-heading px-lg sm:px-xl">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-row py-row">
            <Skeleton width="1.5rem" height="1.5rem" radius="sm" className="shrink-0" />
            <Skeleton width="45%" height="1rem" radius="sm" />
            <Skeleton width="2.5rem" height="1.25rem" radius="sm" className="ms-auto shrink-0" />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function LoadingAgentDashboard() {
  return (
    <AgentScreenSkeleton label="Loading your dashboard">
      {/* The page frame (wide) with its large title and no Back (the
          workspace root), then the band's own head under it. */}
      <div className="nf-g1page" data-width="wide">
      <PageHeaderSkeleton layout="large" back={false} />
      <AgentTitleSkeleton />

      {/* `space-y-section-tight` is `SECTION_GAP`, the one interval the real
          screen's `Stack` puts between its sections. */}
      <div className="space-y-section-tight">
        <GroupSkeleton rows={5} />
        <GroupSkeleton rows={4} />
      </div>
      </div>
    </AgentScreenSkeleton>
  );
}
