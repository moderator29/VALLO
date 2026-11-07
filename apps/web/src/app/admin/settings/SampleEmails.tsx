"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { sendSampleBatch } from "@/lib/admin/sample-emails";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { banner } from "@/lib/ui/toast";

/**
 * Send every kind of email, as a marked sample, to the addresses written here
 * (founder only). Sends a few at a time and keeps asking until the set is done.
 */
export function SampleEmails({ initial }: { initial: string }) {
  const [to, setTo] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function run() {
    const addresses = to
      .split(/[\s,;]+/)
      .map((a) => a.trim())
      .filter(Boolean);
    setBusy(true);
    setNote(null);
    try {
      let offset = 0;
      let sent = 0;
      let failed = 0;
      for (;;) {
        const result = await sendSampleBatch({ to: addresses, offset });
        if (!result.ok) {
          setNote(null);
          banner.error(result.error, { retry: () => void run() });
          return;
        }
        sent += result.data.sent;
        failed += result.data.failed;
        offset = result.data.nextOffset;
        setNote(`Sent ${offset} of ${result.data.total} emails to each address.`);
        if (result.data.done) {
          setNote(null);
          if (failed > 0) banner.warning(`Finished with ${failed} that did not send. ${sent} did.`);
          else
            banner.success(
              `Done. All ${result.data.total} samples are on their way to ${addresses.length === 1 ? "that address" : "both addresses"}.`,
            );
          return;
        }
      }
    } catch (error) {
      setNote(null);
      if (!tapFailedOffline(error)) throw error;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-sm" data-testid="sample-emails">
      <label className="block">
        <span className="nf-label">Send to (one or two addresses)</span>
        <input className="nf-field" value={to} onChange={(e) => setTo(e.target.value)} inputMode="email" autoComplete="off" />
      </label>
      <Button type="button" onClick={run} disabled={busy || to.trim().length < 5}>
        {busy ? "Sending" : "Send every email as a sample"}
      </Button>
      {note && (
        <p role="status" className="nf-body-sm text-[var(--nf-content-secondary)]">
          {note}
        </p>
      )}
    </div>
  );
}
