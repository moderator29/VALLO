import { AgentScreenSkeleton } from "@/components/agent/AgentScreenSkeleton";
import { PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";
import { FigureCardSkeleton } from "@/components/agent/intel/IntelSkeletons";

/**
 * The wait, on one figure's own page: its head, then the figure card at its
 * finished size (period control, figure, plot, the rows by listing), so the
 * card the page lands in is the card already drawn.
 */
export default function LoadingMetric() {
  return (
    <AgentScreenSkeleton label="Loading this figure">
      <div className="nf-g1page">
        <PageHeaderSkeleton layout="large" subtitle />
        <FigureCardSkeleton rows={3} />
      </div>
    </AgentScreenSkeleton>
  );
}
