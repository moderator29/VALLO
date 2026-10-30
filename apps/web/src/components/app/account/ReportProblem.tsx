"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { RowButton } from "@/components/app/account/rows";
import { Sheet } from "@/components/ui/Sheet";
import { TextArea } from "@/components/ui/Field";
import { TicketFiledSheet } from "./TicketFiledSheet";
import { fileSupportTicket } from "@/lib/support/actions";
import { problemBody } from "@/lib/support/problem-body";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

const WORDS = {
  row: "Report a problem",
  rowSub: "Something broken or confusing on this screen? Tell us.",
  title: "Report a problem",
  label: "What went wrong?",
  hint: "A line or two is enough. We add the screen you were on.",
  send: "Send",
  empty: "Tell us what went wrong.",
};

/**
 * Report a problem, from the Help screen and from anywhere a row can open it.
 * It files a support ticket of kind "problem" through the same action the
 * assistant uses, so it lands in the same queue with the screen named.
 */
export function ReportProblemRow() {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [filed, setFiled] = useState<string | null>(null);
  const [pending, startTransition] = useSafeTransition();

  function send() {
    if (!text.trim()) {
      setError(WORDS.empty);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await fileSupportTicket({
        topic: "other",
        kind: "problem",
        body: problemBody(text, pathname),
      });
      if (result.ok) {
        setOpen(false);
        setText("");
        setFiled(result.data.reference);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <>
      <RowButton icon="flag" label={WORDS.row} sub={WORDS.rowSub} onClick={() => setOpen(true)} testId="report-problem" />
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={WORDS.title}
        detents={[0.6]}
        apply={{ label: WORDS.send, onClick: send, loading: pending }}
      >
        <TextArea
          label={WORDS.label}
          hint={WORDS.hint}
          rows={5}
          maxLength={3000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          {...(error ? { error } : {})}
        />
      </Sheet>
      {filed ? <TicketFiledSheet reference={filed} /> : null}
    </>
  );
}
