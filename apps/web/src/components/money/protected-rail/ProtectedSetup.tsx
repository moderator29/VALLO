"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { banner } from "@/lib/ui/toast";
import {
  PROTECTED_IDENTITY_CTA,
  PROTECTED_IDENTITY_DONE,
  PROTECTED_IDENTITY_TITLE,
  PROTECTED_SETUP_LEAD,
  PROTECTED_SETUP_ROWS,
  PROTECTED_SETUP_TITLE,
} from "@/lib/money/copy";
import type { ProtectedSetupRead } from "@/lib/money/protected-start";
import { IdentityCheck } from "./IdentityCheck";
import { DetailRows } from "./kit";

/**
 * A lister's own readiness to be paid through a protected payment, on the
 * payments settings page: the one identity check, and the bank account the
 * payout goes to. Drawn only while the rail is on (the page reads
 * `readProtectedSetup`, which is null otherwise).
 */
export function ProtectedSetup({ setup }: { setup: ProtectedSetupRead }) {
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const identity =
    setup.identity === "done" ? PROTECTED_SETUP_ROWS.identity_done : setup.identity === "needed" ? PROTECTED_SETUP_ROWS.identity_needed : PROTECTED_SETUP_ROWS.unknown;
  const payout =
    setup.payoutAccount === "ready" ? PROTECTED_SETUP_ROWS.payout_ready : setup.payoutAccount === "missing" ? PROTECTED_SETUP_ROWS.payout_missing : PROTECTED_SETUP_ROWS.unknown;

  return (
    <section className="nf-panel nf-panel--card mt-block" aria-labelledby="nf-pp-setup" data-testid="pp-setup">
      <h2 id="nf-pp-setup" className="nf-body font-semibold text-[var(--nf-content-primary)]">
        {PROTECTED_SETUP_TITLE}
      </h2>
      <p className="nf-pp-fine mt-inline">{PROTECTED_SETUP_LEAD}</p>
      <div className="mt-row">
        <DetailRows
          rows={[
            { label: PROTECTED_SETUP_ROWS.identity, value: identity },
            { label: PROTECTED_SETUP_ROWS.payout, value: payout },
          ]}
        />
      </div>
      {setup.identity === "needed" && !checking ? (
        <div className="nf-pp-actions mt-row">
          <Button variant="primary" full onClick={() => setChecking(true)} data-testid="pp-setup-identity" aria-label={`${PROTECTED_IDENTITY_TITLE}: ${PROTECTED_IDENTITY_CTA}`}>
            {PROTECTED_IDENTITY_TITLE}
          </Button>
        </div>
      ) : null}
      {checking ? (
        <div className="mt-row">
        <IdentityCheck
          onVerified={() => {
            setChecking(false);
            banner.success(PROTECTED_IDENTITY_DONE);
            router.refresh();
          }}
        />
        </div>
      ) : null}
    </section>
  );
}
