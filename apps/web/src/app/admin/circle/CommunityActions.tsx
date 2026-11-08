"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { actOnCommunity } from "@/lib/admin/cases/actions";
import { feedback } from "@/lib/ui/feedback";
import { banner } from "@/lib/ui/toast";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

/** Pause, remove or restore a community, always with a reason for the audit log. */
export function CommunityActions({ communityId, status, name }: { communityId: string; status: "live" | "paused" | "removed"; name: string }) {
  const router = useRouter();
  const [action, setAction] = useState<"pause" | "remove" | "restore" | null>(null);
  const [reason, setReason] = useState("");
  const [pending, start] = useSafeTransition();
  const go = () =>
    start(async () => {
      if (!action) return;
      const res = await actOnCommunity({ communityId, action, reason });
      if (res.ok) {
        feedback("confirm");
        banner.success(action === "restore" ? `${name} is live again.` : action === "pause" ? `${name} is paused.` : `${name} is removed.`);
        setAction(null);
        setReason("");
        router.refresh();
      } else {
        feedback("error");
        banner.error(res.error, { retry: go });
      }
    });
  return (
    <div className="flex gap-2xs">
      {status === "live" ? (
        <>
          <Button size="sm" variant="quiet" onClick={() => setAction("pause")}>
            Pause
          </Button>
          <Button size="sm" variant="dangerQuiet" onClick={() => setAction("remove")}>
            Remove
          </Button>
        </>
      ) : (
        <Button size="sm" variant="quiet" onClick={() => setAction("restore")}>
          Restore
        </Button>
      )}
      <Sheet
        open={action !== null}
        onOpenChange={(o) => (o ? null : setAction(null))}
        title={action === "remove" ? `Remove ${name}` : action === "pause" ? `Pause ${name}` : `Restore ${name}`}
        description="Recorded in the audit log with your reason. It can be reversed from here."
        apply={{ label: "Confirm", onClick: go, disabled: reason.trim().length < 5 || pending, loading: pending }}
      >
        <label className="flex flex-col gap-2xs">
          <span className="nf-label">Reason</span>
          <textarea className="nf-field min-h-[5rem]" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} />
        </label>
      </Sheet>
    </div>
  );
}
