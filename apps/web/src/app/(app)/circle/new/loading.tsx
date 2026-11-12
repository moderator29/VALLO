import { StepFrameSkeleton } from "@/app/(app)/_frame/StepFrameSkeleton";

/**
 * Starting a community: the step frame the flow opens in.
 *
 * The flow is a routed page rather than an overlay, so the skeleton keeps the
 * app's header and dock around it, exactly as the frame that lands on it does.
 */
export default function LoadingNewCommunity() {
  return <StepFrameSkeleton label="Loading the community flow" rows={3} overlay={false} />;
}
