"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Dictionary } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { pinTenancyMessage } from "@/lib/tenancy/actions";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

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
  const [error, setError] = useState<string | null>(null);
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
                setError(null);
                start(async () => {
                  const result = await pinTenancyMessage({ tenancyId, messageId: message.id });
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  router.refresh();
                });
              }}
            >
              {copy.pin}
            </Button>
          </li>
        ))}
      </ul>
      {error && (
        <p className="nf-caption text-[var(--nf-state-error)]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
