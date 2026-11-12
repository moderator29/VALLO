import { StepFrameSkeleton } from "@/app/(app)/_frame/StepFrameSkeleton";

/**
 * Asking the community: the step frame the flow opens in.
 *
 * The flow is a routed page rather than an overlay, so the skeleton keeps the
 * app's header and dock around it, exactly as the frame that lands on it does.
 */
export default function LoadingCircleAsk() {
  return <StepFrameSkeleton label="Loading the question" rows={3} overlay={false} />;
}
