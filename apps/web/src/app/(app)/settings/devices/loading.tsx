import { LoadingShell, PageHeaderSkeleton, CardRowsSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * The wait, on the devices screen and the new sign-in alert beneath it.
 *
 * The shape of the folded list (V-19): this device, then a few device lines,
 * then the two panels that end things. Few rows, because the fold means the
 * screen is short now, and a skeleton longer than the page it stands in for
 * makes the arrival look like a collapse.
 */
export default function LoadingDevices() {
  return (
    <LoadingShell label="Loading where you are signed in" className="mx-auto w-full max-w-xl">
      <PageHeaderSkeleton layout="large" />
      <CardRowsSkeleton rows={3} height="4.5rem" />
    </LoadingShell>
  );
}
