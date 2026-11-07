"use client";

import { runPhotoBackfill } from "@/lib/photo-hash/backfill-action";
import { Button } from "@/components/ui/Button";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { banner } from "@/lib/ui/toast";

/**
 * V-45: hash the next batch of old photographs, so the desk can compare them.
 * The words come from the server page, so this client file never imports the
 * dictionary.
 */
export function PhotoBackfillButton({
  copy,
}: {
  /** `photosBackfilled` carries `{count}`. */
  copy: { backfill: string; backfilling: string; backfilled: string };
}) {
  const [pending, startTransition] = useSafeTransition();

  function backfill() {
    startTransition(async () => {
      try {
        const result = await runPhotoBackfill();
        if (result.ok) banner.success(copy.backfilled.replace("{count}", String(result.data.hashed)));
        else banner.error(result.error, { retry: backfill });
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

  return (
    <span className="flex flex-wrap items-center gap-xs">
      <Button
        variant="secondary"
        size="sm"
        type="button"
        loading={pending}
        onClick={backfill}
      >
        {pending ? copy.backfilling : copy.backfill}
      </Button>
    </span>
  );
}
