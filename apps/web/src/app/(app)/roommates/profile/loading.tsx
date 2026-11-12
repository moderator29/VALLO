import { StepFrameSkeleton } from "@/app/(app)/_frame/StepFrameSkeleton";

/**
 * Your roommate profile: the same step frame the flow opens in.
 *
 * The flow is a routed page rather than an overlay, so the skeleton keeps the
 * app's header and dock around it, exactly as the frame that lands on it does.
 */
export default function LoadingRoommateProfileFlow() {
  return <StepFrameSkeleton label="Loading your roommate profile" rows={3} overlay={false} />;
}
