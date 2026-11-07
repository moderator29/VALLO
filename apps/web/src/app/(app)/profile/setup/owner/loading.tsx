import { StepFrameSkeleton } from "@/app/(app)/_frame/StepFrameSkeleton";

/**
 * The owner registration, while it loads (SW12, round 3): the step frame's own shape, so the flow lands on it
 * with nothing moving.
 */
export default function LoadingOwnerRegister() {
  return <StepFrameSkeleton label="Loading the form" rows={2} />;
}
