import { LoadingShell } from "@/components/app/ScreenSkeleton";
import { DealRoomSkeleton } from "@/components/app/offers/Skeletons";

/** The wait on the Deal Room: header, tracker and a panel. */
export default function LoadingDealRoom() {
  return (
    <LoadingShell label="Loading the Deal Room">
      <DealRoomSkeleton />
    </LoadingShell>
  );
}
