import Link from "next/link";

import { UiIcon } from "@/design-system/icons/UiIcon";
import type { ListerIdentity } from "@/lib/verification/lister-identity";

import { Panel } from "../../_review/parts";

/**
 * The lister's identity as a checklist row on the review screen (founder,
 * 10 November 2026). An approval waits on it, so the reviewer sees the status,
 * the cause and what is needed next before pressing Approve, with a link to
 * the person's verification case.
 */
export function IdentityRow({ identity }: { identity: ListerIdentity }) {
  const ok = identity.status === "approved";
  return (
    <Panel>
      <div className="nf-rv-msg" data-testid="review-identity" data-status={identity.status}>
        <UiIcon name={ok ? "check" : "info"} size={16} />{" "}
        <strong>{ok ? "Identity approved" : "Waiting on identity"}</strong>
        {" "}
        <span>{identity.reason}</span>
        {ok ? null : (
          <>
            {" "}
            <span>{identity.nextStep}</span>{" "}
            <Link href={identity.caseHref} data-testid="review-identity-case">
              Open the verification case
            </Link>
          </>
        )}
      </div>
    </Panel>
  );
}
