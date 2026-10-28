"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { addMemberNote } from "@/lib/admin/member-actions";
import { NOTE_MAX, NOTE_MIN } from "@/lib/admin/member-file-rules";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

/**
 * Write a note on this person's file. Notes cannot be edited or deleted, by
 * anyone, so the form says so before the operator presses the button; a
 * correction is a second note.
 */
export function NoteForm({ userId }: { userId: string }) {
  const fieldId = useId();
  const hintId = useId();
  const router = useRouter();
  const [body, setBody] = useState("");
  const [result, setResult] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useSafeTransition();

  return (
    <form
      className="mt-row grid gap-xs"
      onSubmit={(event) => {
        event.preventDefault();
        start(async () => {
          const r = await addMemberNote({ userId, body });
          if (r.ok) {
            setBody("");
            setResult({ tone: "ok", text: "Note saved. It is on the file and in the audit log." });
            router.refresh();
          } else {
            setResult({ tone: "error", text: r.error });
          }
        });
      }}
    >
      <label htmlFor={fieldId} className="nf-label">
        Add a note for the team
      </label>
      <textarea
        id={fieldId}
        aria-describedby={hintId}
        className="nf-field min-h-20"
        maxLength={NOTE_MAX}
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <p id={hintId} className="nf-caption text-[var(--nf-content-muted)]">
        Staff only; the member never sees it. A note cannot be edited or deleted, so write facts: who you spoke to, what
        was said, what happens next.
      </p>
      <div>
        <Button type="submit" variant="primary" size="md" loading={pending} disabled={body.trim().length < NOTE_MIN}>
          Save note
        </Button>
      </div>
      {result && (
        <p
          role={result.tone === "error" ? "alert" : "status"}
          className="text-[length:var(--nf-text-caption)]"
          style={{ color: result.tone === "error" ? "var(--nf-state-error)" : "var(--nf-content-secondary)" }}
        >
          {result.text}
        </p>
      )}
    </form>
  );
}
