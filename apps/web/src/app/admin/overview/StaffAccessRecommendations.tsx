"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { banner } from "@/lib/ui/toast";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { recommendStaffAccess } from "@/lib/admin/overview/actions";
import type { StaffAccessRecommendation } from "@/lib/admin/overview/reads";

/**
 * "Recommend staff access changes to the super admin as the team changes"
 * (JOB_DESCRIPTIONS.coo). The COO cannot grant or revoke access here, or
 * anywhere outside the Staff desk: this writes a note only, and every
 * recommendation reads "sent to the founder, awaiting action" until it is
 * actioned or declined there.
 */
export function StaffAccessRecommendations({ recommendations }: { recommendations: StaffAccessRecommendation[] }) {
  return (
    <div className="grid gap-sm" data-testid="staff-access-recommendations">
      <RecommendForm />
      {recommendations.length === 0 ? (
        <p className="nf-body text-[var(--nf-content-secondary)]">No recommendations sent yet.</p>
      ) : (
        <ul className="nf-admin-queue">
          {recommendations.map((r) => (
            <li key={r.id} className="nf-admin-queue-row" data-testid="recommendation-row">
              <p className="font-semibold">
                {r.aboutName}
                <span className="nf-caption text-[var(--nf-content-secondary)]"> · {r.recommendedPositionOrScope}</span>
              </p>
              <p className="nf-body text-[var(--nf-content-secondary)]">{r.reason}</p>
              <p className="nf-caption">
                {r.status === "open" ? "Sent to the founder, awaiting action" : r.status === "actioned" ? "Actioned" : "Declined"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RecommendForm() {
  const [aboutName, setAboutName] = useState("");
  const [what, setWhat] = useState("");
  const [reason, setReason] = useState("");
  const [pending, start] = useSafeTransition();
  const router = useRouter();

  function submit() {
    start(async () => {
      const result = await recommendStaffAccess({ aboutName, recommendedPositionOrScope: what, reason });
      if (!result.ok) {
        banner.error(result.error);
        return;
      }
      banner.success("Sent to the founder.");
      setAboutName("");
      setWhat("");
      setReason("");
      router.refresh();
    });
  }

  return (
    <form
      className="grid gap-xs"
      data-testid="recommend-staff-access-form"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="grid gap-xs sm:grid-cols-2">
        <label className="grid gap-2xs nf-body">
          <span>Who</span>
          <input className="nf-field" value={aboutName} onChange={(e) => setAboutName(e.target.value)} placeholder="Name or email" />
        </label>
        <label className="grid gap-2xs nf-body">
          <span>Recommended position or scope</span>
          <input className="nf-field" value={what} onChange={(e) => setWhat(e.target.value)} placeholder="Support, or Support Lead" />
        </label>
      </div>
      <label className="grid gap-2xs nf-body">
        <span>Why</span>
        <textarea className="nf-field" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      <Button type="submit" variant="primary" loading={pending} data-testid="recommend-staff-access-submit">
        Send to the founder
      </Button>
    </form>
  );
}
