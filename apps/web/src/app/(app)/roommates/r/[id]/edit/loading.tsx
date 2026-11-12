import { StepFrameSkeleton } from "@/app/(app)/_frame/StepFrameSkeleton";

/**
 * Editing a listing: the same step frame the post flow opens in, not the
 * listing page the route group's skeleton would otherwise draw.
 *
 * The flow is a routed page rather than an overlay, so the skeleton keeps the
 * app's header and dock around it, exactly as the frame that lands on it does.
 */
export default function LoadingEditRoommatePost() {
  return <StepFrameSkeleton label="Loading the post flow" rows={4} overlay={false} />;
}
