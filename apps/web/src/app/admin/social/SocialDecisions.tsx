"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  decideArea,
  decideModeratorApplication,
  setAreaPaused,
} from "@/lib/social/admin-actions";
import { Button } from "@/components/ui/Button";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { banner } from "@/lib/ui/toast";

/**
 * The decision controls for Around.
 *
 * Every refusal here - declining an area, declining a moderator, pausing a
 * place - used to be drawn as a ghost button beside a solid blue primary, which
 * made the destructive half of each pair the quietest thing in its row. They
 * are solid danger buttons now, so what the control does and how it looks
 * agree.
 *
 * A rejection or a decline always carries a note field, and the note is what
 * the person actually receives. An operations console that lets somebody say no
 * without saying why turns every refusal into a mystery, and a mystery is what
 * people appeal.
 *
 * Nothing here is optimistic. These are decisions that reach a real person by
 * notification, so the row waits for the server and then refreshes, rather than
 * showing an approval that might not have landed.
 */
function useDecision() {
  const router = useRouter();
  const [pending, startTransition] = useSafeTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>): void => {
    startTransition(async () => {
      try {
        const result = await fn();
        if (!result.ok) {
          banner.error(result.error ?? "That did not go through. Try again.", { retry: () => run(fn) });
          return;
        }
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  return { pending, run };
}

function NoteField({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  disabled: boolean;
}) {
  return (
    <textarea
      className="nf-field min-h-[64px] w-full resize-y text-[length:var(--nf-text-body-sm)]"
      value={value}
      maxLength={400}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export function AreaDecision({ areaId, name }: { areaId: string; name: string }) {
  const { pending, run } = useDecision();
  const [note, setNote] = useState("");

  return (
    <div className="mt-sm">
      <NoteField
        value={note}
        onChange={setNote}
        disabled={pending}
        placeholder={`Why ${name} is or is not opening. If you decline, this is what they read.`}
      />
      <div className="mt-xs flex flex-wrap gap-xs">
        <Button
          variant="primary"
          size="sm"
          disabled={pending}
          onClick={() => run(() => decideArea({ areaId, decision: "APPROVE", note }))}
        >
          {pending ? "Working" : "Open this place"}
        </Button>
        <Button
          variant="danger"
          size="sm"
          disabled={pending || note.trim().length === 0}
          onClick={() => run(() => decideArea({ areaId, decision: "REJECT", note }))}
          title={note.trim().length === 0 ? "Say why first" : undefined}
        >
          Decline
        </Button>
      </div>
      {note.trim().length === 0 ? (
        <p className="mt-xs text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
          Declining needs a reason. They receive it word for word.
        </p>
      ) : null}
    </div>
  );
}

export function ModeratorDecision({
  applicationId,
  areaName,
}: {
  applicationId: string;
  areaName: string;
}) {
  const { pending, run } = useDecision();
  const [note, setNote] = useState("");

  return (
    <div className="mt-sm">
      <NoteField
        value={note}
        onChange={setNote}
        disabled={pending}
        placeholder={`A note to them about ${areaName}. If you decline, this is what they read.`}
      />
      <div className="mt-xs flex flex-wrap gap-xs">
        <Button
          variant="primary"
          size="sm"
          disabled={pending}
          onClick={() =>
            run(() =>
              decideModeratorApplication({ applicationId, decision: "APPROVE", note }),
            )
          }
        >
          {pending ? "Working" : "Approve as moderator"}
        </Button>
        <Button
          variant="danger"
          size="sm"
          disabled={pending || note.trim().length === 0}
          onClick={() =>
            run(() =>
              decideModeratorApplication({ applicationId, decision: "DECLINE", note }),
            )
          }
        >
          Decline
        </Button>
      </div>
      <p className="mt-xs text-[length:var(--nf-text-overline)] leading-relaxed text-[var(--nf-content-muted)]">
        Approving lets them hide a post while somebody reviews it. It does not let
        them delete one, and it grants nothing outside this place.
      </p>
    </div>
  );
}

export function PauseToggle({
  areaId,
  paused,
  name,
}: {
  areaId: string;
  paused: boolean;
  name: string;
}) {
  const { pending, run } = useDecision();
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button
        variant={paused ? "secondary" : "danger"}
        size="sm"
        onClick={() => setOpen(true)}
      >
        {paused ? "Bring back" : "Pause"}
      </Button>
    );
  }

  return (
    <div className="w-full">
      <NoteField
        value={note}
        onChange={setNote}
        disabled={pending}
        placeholder={paused ? `Why ${name} is coming back.` : `Why ${name} is pausing.`}
      />
      <div className="mt-xs flex flex-wrap gap-xs">
        <Button
          variant={paused ? "primary" : "danger"}
          size="sm"
          disabled={pending}
          onClick={() => run(() => setAreaPaused({ areaId, paused: !paused, note }))}
        >
          {pending ? "Working" : paused ? "Bring it back" : "Pause it"}
        </Button>
        <Button variant="secondary" size="sm" disabled={pending} onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
