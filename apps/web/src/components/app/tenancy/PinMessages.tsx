"use client";

import { banner } from "@/lib/ui/toast";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Dictionary } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { pinTenancyMessage } from "@/lib/tenancy/actions";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * V-47. Pin a message from the thread with the other party to the tenancy,
 * so it is kept with the file (until tenancy end plus six years) rather than
 * with the thread. Closed until opened; a pin cannot be undone, and the
 * control says so.
 */
export function PinMessages({
  tenancyId,
  candidates,
  copy,
}: {
  tenancyId: string;
  candidates: { id: string; body: string; date: string }[];
  copy: Dictionary["afterTheGate"]["tenancy"];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useSafeTransition();
  if (candidates.length === 0) return null;
  if (!open) {
    return (
      <Button variant="secondary" full onClick={() => setOpen(true)} data-testid="pin-open">
        {copy.pinOpen}
      </Button>
    );
  }
  return (
    <div className="grid gap-sm" data-testid="pin-messages">
      <p className="nf-body-sm text-[var(--nf-content-secondary)]">{copy.pinHelp}</p>
      <ul className="grid gap-xs">
        {candidates.map((message) => (
          <li key={message.id} className="nf-card flex items-start justify-between gap-sm p-card">
            <div className="min-w-0">
              <p className="nf-caption">{message.date}</p>
              <p className="nf-body-sm mt-2xs line-clamp-3 whitespace-pre-line">{message.body}</p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                start(async () => {
                  try {
                    const result = await pinTenancyMessage({ tenancyId, messageId: message.id });
                    if (!result.ok) {
                      banner.error(result.error);
                      return;
                    }
                    banner.success("Message pinned");
                    router.refresh();
                  } catch (error) {
                    if (!tapFailedOffline(error)) throw error;
                  }
                });
              }}
            >
              {copy.pin}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
