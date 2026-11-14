"use client";

import { Button } from "@/components/ui/Button";
import { banner, updateToast } from "@/lib/ui/toast";

/**
 * Every tone of the top banner, so its rail, plate and glow can be looked at
 * rather than read about. The harness only: no product screen mounts this.
 */
export function BannerDeck() {
  const underWay = () => {
    const id = banner.processing("Sending your offer");
    window.setTimeout(() => {
      updateToast(id, { message: "Offer sent. The agent has it.", tone: "success" });
    }, 2600);
  };

  return (
    <div className="flex flex-wrap gap-sm p-gutter">
      <Button variant="secondary" size="sm" onClick={() => banner.success("Listing published")}>
        Success
      </Button>
      <Button variant="secondary" size="sm" onClick={() => banner.error("That did not send. Nothing was lost.")}>
        Error
      </Button>
      <Button variant="secondary" size="sm" onClick={() => banner.warning("Your mandate runs out in six days")}>
        Warning
      </Button>
      <Button variant="secondary" size="sm" onClick={() => banner.info("Three new homes match your search")}>
        Info
      </Button>
      <Button variant="secondary" size="sm" onClick={underWay} data-testid="banner-processing">
        Processing, then success
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() =>
          banner.error("Could not reach the server.", { retry: () => banner.success("Sent") })
        }
      >
        Error with retry
      </Button>
    </div>
  );
}
