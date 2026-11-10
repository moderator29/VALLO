"use client";

import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import { TextArea } from "@/components/ui/Field";
import { adminIntervene } from "@/lib/offers/actions";
import { useAct } from "@/components/app/deal-room/act";

type Action = "note" | "flag_dispute" | "resolve_dispute" | "cancel";

const LABEL: Record<Action, { name: string; detail: string; done: string }> = {
  note: { name: "Add a staff note", detail: "Recorded on the deal. Neither party is changed.", done: "Note recorded." },
  flag_dispute: { name: "Flag a dispute", detail: "Opens or links a case in the cases desk.", done: "Dispute flagged." },
  resolve_dispute: { name: "Resolve the dispute", detail: "Closes the flag once the case is decided.", done: "Dispute resolved." },
  cancel: { name: "Cancel the deal", detail: "Ends the deal and keeps the full history. Agreed terms are never edited.", done: "Deal cancelled." },
};

/**
 * Intervention that cannot rewrite agreed terms. There is no control here to
 * change a figure, a version or who agreed to what: only a note, a dispute flag
 * and a cancellation, each with a written reason that is kept in the audit log.
 * The console asks for the security key before any of them is accepted.
 */
export function Intervention({ offerId, disputed, caseHref, canCancel }: { offerId: string; disputed: boolean; caseHref: string; canCancel: boolean }) {
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<Action>("note");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | undefined>();
  const { pending, run } = useAct();
  const options = (["note", disputed ? "resolve_dispute" : "flag_dispute", ...(canCancel ? (["cancel"] as const) : [])] as Action[]).map((a) => ({ value: a, label: LABEL[a].name }));

  return (
    <div className="grid gap-sm" data-testid="intervention">
      <p className="nf-body text-[var(--nf-content-secondary)]">Staff can add a note, flag or resolve a dispute, and cancel a deal. Staff cannot change agreed terms, an amount or a version.</p>
      <div className="flex flex-wrap gap-sm">
        <Button variant="primary" onClick={() => { setAction(options[0]!.value as Action); setOpen(true); }} data-testid="intervene-open">
          Intervene
        </Button>
        <ButtonLink href={caseHref} variant="secondary">
          Open the cases desk
        </ButtonLink>
      </div>
      <Sheet open={open} onOpenChange={setOpen} title="Intervene on this deal" detents={[0.8]}>
        <div className="grid gap-md pb-lg">
          <Segmented label="Action" semantics="radio" stack full value={action} onChange={setAction} options={options} />
          <p className="nf-body-sm text-[var(--nf-content-muted)]">{LABEL[action].detail}</p>
          <TextArea label="Reason" required value={note} maxLength={800} rows={4} error={error} onChange={(e) => { setError(undefined); setNote(e.target.value); }} hint="Kept in the audit log with your name and the time." />
          <Button
            variant={action === "cancel" ? "danger" : "primary"}
            size="lg"
            full
            loading={pending}
            data-testid="intervene-confirm"
            onClick={() => (note.trim() ? void run(() => adminIntervene({ offerId, action, note: note.trim() }), LABEL[action].done, () => { setOpen(false); setNote(""); }) : setError("Write the reason first."))}
          >
            {LABEL[action].name}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
