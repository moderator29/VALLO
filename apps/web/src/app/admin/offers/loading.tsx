import { QueueSkeleton } from "../_components/QueueSkeleton";

/** The wait on the Offers and deals desk: the console's queue shape. */
export default function LoadingOffersDesk() {
  return <QueueSkeleton label="Loading offers and deals" rows={5} />;
}
