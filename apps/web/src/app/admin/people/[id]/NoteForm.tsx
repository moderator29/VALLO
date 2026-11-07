"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { addMemberNote } from "@/lib/admin/member-actions";
import { NOTE_MAX, NOTE_MIN } from "@/lib/admin/member-file-rules";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { banner } from "@/lib/ui/toast";

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
  const [pending, start] = useSafeTransition();

  function save() {
    start(async () => {
      try {
        const r = await addMemberNote({ userId, body });
        if (r.ok) {
          setBody("");
          banner.success("Note saved. It is on the file and in the audit log.");
          router.refresh();
        } else {
          banner.error(r.error, { retry: save });
        }
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

  return (
    <form
      className="mt-row grid gap-xs"
      onSubmit={(event) => {
        event.preventDefault();
        save();
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
    </form>
  );
}
