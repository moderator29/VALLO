"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { decideAppeal } from "@/lib/admin/cases/actions";
import { feedback } from "@/lib/ui/feedback";
import { banner } from "@/lib/ui/toast";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

/** Accept (lift the restriction) or uphold, with the words the member reads. */
export function AppealDecision({ appealId }: { appealId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, start] = useSafeTransition();
  const decide = (overturn: boolean) =>
    start(async () => {
      const res = await decideAppeal({ appealId, overturn, note });
      if (res.ok) {
        feedback("confirm");
        banner.success(overturn ? "Appeal accepted. The restriction is lifted and the member is told." : "Appeal upheld. The member is told.");
        router.refresh();
      } else {
        feedback("error");
        banner.error(res.error, { retry: () => decide(overturn) });
      }
    });
  return (
    <div className="flex flex-col gap-sm">
      <label className="flex flex-col gap-2xs">
        <span className="nf-label">Decision the member will read</span>
        <textarea className="nf-field min-h-[5rem]" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
      </label>
      <div className="flex flex-wrap gap-xs">
        <Button size="sm" variant="primary" loading={pending} disabled={note.trim().length < 5} onClick={() => decide(true)}>
          Accept and lift
        </Button>
        <Button size="sm" variant="secondary" loading={pending} disabled={note.trim().length < 5} onClick={() => decide(false)}>
          Uphold
        </Button>
      </div>
    </div>
  );
}
