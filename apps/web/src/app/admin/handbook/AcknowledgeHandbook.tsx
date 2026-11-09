"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { acknowledgeHandbook } from "@/lib/admin/staff-actions";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { banner } from "@/lib/ui/toast";

export function AcknowledgeHandbook({ version }: { version: string }) {
  const [read, setRead] = useState(false);
  const [pending, start] = useSafeTransition();
  const router = useRouter();
  function acknowledge() {
    start(async () => {
      try {
        const result = await acknowledgeHandbook({ version });
        if (!result.ok) banner.error(result.error, { retry: acknowledge });
        else {
          banner.success("Handbook acknowledged");
          router.replace("/admin");
          router.refresh();
        }
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

  return (
    <div className="grid gap-xs">
      <label className="flex items-start gap-xs nf-body">
        <input type="checkbox" checked={read} onChange={(e) => setRead(e.target.checked)} data-testid="handbook-read" />
        <span>I have read the whole handbook and I will follow it.</span>
      </label>
      <div>
        <Button
          variant="primary"
          size="md"
          disabled={!read || pending}
          data-testid="handbook-acknowledge"
          onClick={acknowledge}
        >
          Acknowledge and unlock my desks
        </Button>
      </div>
    </div>
  );
}
