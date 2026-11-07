import { StepFrameSkeleton } from "@/app/(app)/_frame/StepFrameSkeleton";

/**
 * Adding a workspace, while it loads (SW12, round 3): the step frame's own shape, so the flow lands on it
 * with nothing moving.
 */
export default function LoadingSetup() {
  return <StepFrameSkeleton label="Loading" rows={5} art eyebrow={false} />;
}
