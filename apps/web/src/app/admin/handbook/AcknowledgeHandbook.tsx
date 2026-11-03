"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { acknowledgeHandbook } from "@/lib/admin/staff-actions";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

export function AcknowledgeHandbook({ version }: { version: string }) {
  const [read, setRead] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
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
          onClick={() =>
            start(async () => {
              try {
                const result = await acknowledgeHandbook({ version });
                if (!result.ok) setError(result.error);
                else {
                  /* Straight into the console, where their desks and their
                     position are now open, rather than staying on this page. */
                  router.replace("/admin");
                  router.refresh();
                }
              } catch (error) {
                if (!tapFailedOffline(error)) throw error;
              }
            })
          }
        >
          Acknowledge and unlock my desks
        </Button>
      </div>
      {error ? (
        <p className="nf-body text-[var(--nf-state-error)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
