"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { addMemberNote } from "@/lib/admin/notes-actions";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

export function NoteForm({
  subjectId,
  path,
  scopes,
}: {
  subjectId: string;
  path: string;
  /** The scopes the writer holds, as options to restrict a note to. */
  scopes: { value: string; label: string }[];
}) {
  const [body, setBody] = useState("");
  const [scope, setScope] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useSafeTransition();
  const router = useRouter();
  return (
    <form
      /* One column that may shrink below its content: in the support desk's
         narrow side column the scope select's longest option set the grid's
         width and the field ran 8px past its card at 1440 (C1 sweep). */
      className="mt-xs grid grid-cols-[minmax(0,1fr)] gap-2xs"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          try {
            const result = await addMemberNote({ subjectId, body, scope: scope || null, path });
            if (!result.ok) setError(result.error);
            else {
              setBody("");
              setScope("");
              router.refresh();
            }
          } catch (error) {
            if (!tapFailedOffline(error)) throw error;
          }
        });
      }}
    >
      <label className="nf-label" htmlFor={`note-${subjectId}`}>
        Add an internal note (staff only; the member never sees it)
      </label>
      <textarea
        id={`note-${subjectId}`}
        className="nf-field"
        rows={2}
        maxLength={2000}
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="flex flex-wrap items-center gap-xs">
        <select className="nf-field w-auto min-w-0 max-w-full" value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Who can read it">
          <option value="">Every member of staff can read it</option>
          {scopes.map((s) => (
            <option key={s.value} value={s.value}>
              Only {s.label} and admins
            </option>
          ))}
        </select>
        <Button type="submit" variant="secondary" size="sm" disabled={pending || body.trim().length < 3}>
          Save note
        </Button>
      </div>
      {error ? (
        <p className="nf-caption text-[var(--nf-state-error)]" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
