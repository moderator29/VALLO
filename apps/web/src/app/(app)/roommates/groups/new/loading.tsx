import { StepFrameSkeleton } from "@/app/(app)/_frame/StepFrameSkeleton";

/**
 * Starting a group: the step frame the flow opens in.
 *
 * The flow is a routed page rather than an overlay, so the skeleton keeps the
 * app's header and dock around it, exactly as the frame that lands on it does.
 */
export default function LoadingNewRoommateGroup() {
  return <StepFrameSkeleton label="Loading the group flow" rows={3} overlay={false} />;
}
