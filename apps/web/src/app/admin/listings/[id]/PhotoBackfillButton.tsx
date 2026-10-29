"use client";

import { useState } from "react";
import { runPhotoBackfill } from "@/lib/photo-hash/backfill-action";
import { Button } from "@/components/ui/Button";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

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
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useSafeTransition();
  return (
    <span className="flex flex-wrap items-center gap-xs">
      <Button
        variant="secondary"
        size="sm"
        type="button"
        loading={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await runPhotoBackfill();
            setNote(
              result.ok
                ? { ok: true, text: copy.backfilled.replace("{count}", String(result.data.hashed)) }
                : { ok: false, text: result.error },
            );
          })
        }
      >
        {pending ? copy.backfilling : copy.backfill}
      </Button>
      {note && (
        <span role={note.ok ? "status" : "alert"} className="nf-caption">
          {note.text}
        </span>
      )}
    </span>
  );
}
