"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { appealRestriction } from "@/lib/features/standing/actions";
import { feedback } from "@/lib/ui/feedback";
import { banner } from "@/lib/ui/toast";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

/** Appeal one restriction: a sheet with one question, the outcome in a banner. */
export function AppealButton({ restrictionId }: { restrictionId: string }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [pending, start] = useSafeTransition();

  const send = () =>
    start(async () => {
      const res = await appealRestriction({ restrictionId, body });
      if (res.ok) {
        feedback("confirm");
        banner.success("Appeal sent. Someone who did not make the decision will review it.");
        setOpen(false);
        setBody("");
      } else {
        feedback("error");
        banner.error(res.error, { retry: send });
      }
    });

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)} data-testid="standing-appeal">
        Appeal
      </Button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="Appeal this decision"
        description="Tell us what we got wrong. A member of the team who did not make the decision reviews every appeal."
        apply={{ label: "Send appeal", onClick: send, disabled: body.trim().length < 10, loading: pending }}
      >
        <TextArea id="appeal-body" label="Why should we look again?" value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={2000} />
      </Sheet>
    </>
  );
}
