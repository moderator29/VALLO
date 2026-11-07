import { StepFrameSkeleton } from "@/app/(app)/_frame/StepFrameSkeleton";

/**
 * The professional application, while it loads (SW12, round 3): the step frame's own shape, so the flow lands on it
 * with nothing moving.
 */
export default function LoadingApplication() {
  return <StepFrameSkeleton label="Loading the application" rows={4} />;
}
