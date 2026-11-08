"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { plural } from "@vallo/i18n/core";

import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { liftRestriction, restrictMember } from "@/lib/admin/cases/actions";
import { RESTRICTION_DAYS, RESTRICTION_KINDS, RESTRICTION_LABEL, type RestrictionKind } from "@/lib/admin/cases/model";
import { feedback } from "@/lib/ui/feedback";
import { banner } from "@/lib/ui/toast";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

/**
 * Restrict a member from their file (no case needed), or lift one restriction
 * (`liftId`). The database decides whether this staff member may: a
 * suspension, or anything longer than 30 days, needs Trust and Safety.
 */
export function MemberStandingControls({ userId, liftId }: { userId: string; liftId?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<RestrictionKind>("warning");
  const [days, setDays] = useState<number | null>(7);
  const [reason, setReason] = useState("");
  const [pending, start] = useSafeTransition();

  const go = () =>
    start(async () => {
      const res = liftId
        ? await liftRestriction({ restrictionId: liftId, reason })
        : await restrictMember({ userId, kind, days: kind === "warning" ? 0 : days, reason });
      if (res.ok) {
        feedback("confirm");
        banner.success(liftId ? "Restriction lifted. The member has been told." : "Done. The member has been told, with your reason.");
        setOpen(false);
        setReason("");
        router.refresh();
      } else {
        feedback("error");
        banner.error(res.error, { retry: go });
      }
    });

  return (
    <>
      <Button size="sm" variant={liftId ? "quiet" : "dangerQuiet"} onClick={() => setOpen(true)}>
        {liftId ? "Lift" : "Restrict"}
      </Button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={liftId ? "Lift this restriction" : "Restrict this member"}
        description={liftId ? "The member is told at once." : "The member is told at once with your reason, and can appeal. A suspension, or anything longer than 30 days, needs Trust and Safety."}
        apply={{ label: liftId ? "Lift" : "Apply", onClick: go, disabled: reason.trim().length < (liftId ? 5 : 10) || pending, loading: pending }}
      >
        <div className="flex flex-col gap-sm">
          {!liftId ? (
            <>
              <label className="flex flex-col gap-2xs">
                <span className="nf-label">Restriction</span>
                <select className="nf-field" value={kind} onChange={(e) => setKind(e.target.value as RestrictionKind)}>
                  {RESTRICTION_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {RESTRICTION_LABEL[k]}
                    </option>
                  ))}
                </select>
              </label>
              {kind !== "warning" ? (
                <label className="flex flex-col gap-2xs">
                  <span className="nf-label">For how long</span>
                  <select className="nf-field" value={days === null ? "none" : String(days)} onChange={(e) => setDays(e.target.value === "none" ? null : Number(e.target.value))}>
                    {RESTRICTION_DAYS.map((d) => (
                      <option key={d === null ? "none" : d} value={d === null ? "none" : String(d)}>
                        {d === null ? "Until lifted" : plural(d, { one: "{count} day", other: "{count} days" })}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </>
          ) : null}
          <label className="flex flex-col gap-2xs">
            <span className="nf-label">Reason the member will read</span>
            <textarea className="nf-field min-h-[6rem]" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} />
          </label>
        </div>
      </Sheet>
    </>
  );
}
