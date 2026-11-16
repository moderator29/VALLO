"use client";

import { Button } from "@/components/ui/Button";
import { banner } from "@/lib/ui/toast";

/** Every voice side by side, so the pill and the banner can be compared. */
export function QuickPillDeck() {
  return (
    <div className="mt-md flex flex-wrap gap-sm">
      <Button variant="secondary" size="sm" onClick={() => banner.quick("Message copied")}>
        Message copied
      </Button>
      <Button variant="secondary" size="sm" onClick={() => banner.quick("Link copied")}>
        Link copied
      </Button>
      <Button variant="secondary" size="sm" onClick={() => banner.quick("Saved")}>
        Saved
      </Button>
      <Button variant="secondary" size="sm" onClick={() => banner.quick("Removed from Saved")}>
        Removed from Saved
      </Button>
      <Button variant="secondary" size="sm" onClick={() => banner.quick("Photo saved")}>
        Photo saved
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => banner.error("Could not copy. Select it and copy by hand.")}
      >
        A failure (top banner)
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => banner.success("Saved. It is in Saved.", { action: { label: "Undo", run: () => undefined } })}
      >
        An undo (top banner)
      </Button>
      {/* The host comes from the root layout's DetailsHost, as on every page. */}
    </div>
  );
}
