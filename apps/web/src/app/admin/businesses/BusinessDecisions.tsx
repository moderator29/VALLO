"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  approveBusiness,
  publishAccommodation,
  publishRestaurant,
  recordBusinessRung,
  rejectBusiness,
  requestMoreInfo,
} from "@/lib/admin/business-actions";
import type { BusinessRung } from "@/lib/admin/business-queries";
import type { BusinessDecision } from "@/lib/admin/business-decision";
import { Button } from "@/components/ui/Button";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * The three hands this desk offers, and nothing else.
 *
 * Deliberately inline rather than through the console's shared confirm sheet.
 * A reviewer works this queue with the application open in front of them: the
 * documents, the CAC number, the bank name and the hours are all on the card,
 * and a sheet that covers them to ask "are you sure" asks the question with the
 * evidence hidden. `HoldDecision` on the moderation desk made the same call for
 * the same reason.
 *
 * NOTHING HERE IS OPTIMISTIC. Every one of these decisions reaches a real
 * person by notification, so the row waits for the server and then refreshes
 * from the database rather than drawing what it hopes happened.
 */

const NOTE_MIN = 12;

function Refusal({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="nf-caption mt-row text-[var(--nf-state-error)]">
      {message}
    </p>
  );
}

/**
 * Approve, ask for a change, or refuse.
 *
 * The note field is shared by the two decisions that need one, and both of
 * them stay disabled until it holds a sentence. The minimum is the server's
 * own: "blurry" is a complete and useful answer and "no" is not, and a host
 * told no with nothing to answer uploads the same document again and concludes
 * the platform is refusing them personally.
 */
export function BusinessReviewDecision({
  businessId,
  name,
  offered = ["approve", "more_info", "reject"],
}: {
  businessId: string;
  name: string;
  /**
   * The hands the server would accept for this business's state
   * (`decisionsOffered`). An approved business is not offered Approve again:
   * pressing it changed nothing but sent the owner a second approval.
   */
  offered?: readonly BusinessDecision[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useSafeTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const run = (decision: "approve" | "more_info" | "reject") => {
    setError(null);
    startTransition(async () => {
      try {
        const result =
          decision === "approve"
            ? await approveBusiness({ businessId })
            : decision === "more_info"
              ? await requestMoreInfo({ businessId, note: note.trim() })
              : await rejectBusiness({ businessId, note: note.trim() });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setNote("");
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  const canWrite = note.trim().length >= NOTE_MIN;

  return (
    <div className="mt-group">
      <label className="nf-label" htmlFor={`note-${businessId}`}>
        What this host needs to hear
      </label>
      <textarea
        id={`note-${businessId}`}
        className="nf-field mt-inline-tight min-h-[64px] w-full resize-y"
        rows={4}
        value={note}
        maxLength={400}
        disabled={pending}
        placeholder={`Why ${name} is going back, in a sentence they can answer. They read this word for word.`}
        onChange={(event) => setNote(event.target.value)}
      />

      <div className="mt-row flex flex-wrap gap-inline">
        {offered.includes("approve") && (
          <Button variant="primary" size="sm" disabled={pending} onClick={() => run("approve")}>
            {pending ? "Working" : "Approve"}
          </Button>
        )}
        {offered.includes("more_info") && (
          <Button
            variant="secondary"
            size="sm"
            disabled={pending || !canWrite}
            title={canWrite ? undefined : "Say what needs changing first"}
            onClick={() => run("more_info")}
          >
            Ask for a change
          </Button>
        )}
        {offered.includes("reject") && (
          <Button
            variant="danger"
            size="sm"
            disabled={pending || !canWrite}
            title={canWrite ? undefined : "Say why first"}
            onClick={() => run("reject")}
          >
            Refuse
          </Button>
        )}
      </div>

      {!canWrite && (
        <p className="nf-caption mt-row">
          {offered.includes("approve")
            ? "Approving needs no words. Sending it back or refusing needs a sentence the host can answer, and they are shown it exactly as it is typed."
            : "Already approved. Sending it back or refusing needs a sentence the host can answer, and they are shown it exactly as it is typed."}
        </p>
      )}
      <Refusal message={error} />
    </div>
  );
}

/**
 * Put it on the shelf.
 *
 * Two shapes on one control, because a reviewer is doing one thing: a
 * restaurant goes live as itself, a stay goes live as a property, and the
 * server decides which gates apply. The refusal that comes back names the one
 * thing that is missing, so this never has to guess in advance.
 */
export function PublishControl({
  target,
  label,
}: {
  target: { kind: "restaurant"; businessId: string } | { kind: "property"; accommodationId: string };
  /** What is being put in front of guests, named. */
  label: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useSafeTransition();
  const [error, setError] = useState<string | null>(null);

  const run = () => {
    setError(null);
    startTransition(async () => {
      try {
        const result =
          target.kind === "restaurant"
            ? await publishRestaurant({ businessId: target.businessId })
            : await publishAccommodation({ accommodationId: target.accommodationId });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  return (
    <div className="mt-row">
      <Button variant="primary" size="sm" disabled={pending} onClick={run}>
        {pending ? "Working" : `Put ${label} on the shelf`}
      </Button>
      <Refusal message={error} />
    </div>
  );
}

/**
 * One rung of the verification ladder, recorded by a person.
 *
 * THE IDENTITY RUNG IS THE BADGE, and that is the whole reason this control is
 * shaped the way it is. `businesses.verified` is derived by trigger from the
 * identity rung and nothing else, so this is the only button in the product
 * that can light a verified mark. It refuses to be pressed while no identity
 * document is on file: a rung recorded against nothing is a badge no human
 * check earned, and rule 12 is absolute.
 *
 * A failed rung always carries the reviewer's words. It can drop a business's
 * level in public, and a host told their registration check failed with no
 * reason cannot answer it.
 */
export function RungDecision({
  businessId,
  rung,
  label,
  /** False when the evidence this rung is decided from is not on file. */
  evidenced = true,
  missingEvidence,
}: {
  businessId: string;
  rung: BusinessRung;
  label: string;
  evidenced?: boolean;
  missingEvidence?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useSafeTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const run = (status: "passed" | "failed") => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await recordBusinessRung({
          businessId,
          rung,
          status,
          ...(note.trim().length > 0 ? { note: note.trim() } : {}),
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setNote("");
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  const canFail = note.trim().length >= NOTE_MIN;

  return (
    <div className="mt-row">
      <label className="sr-only" htmlFor={`rung-${businessId}-${rung}`}>
        What was checked for {label}
      </label>
      <textarea
        id={`rung-${businessId}-${rung}`}
        className="nf-field min-h-[44px] w-full resize-y"
        rows={3}
        value={note}
        maxLength={400}
        disabled={pending}
        placeholder={`What was checked, or what did not check out. Required to fail ${label.toLowerCase()}.`}
        onChange={(event) => setNote(event.target.value)}
      />
      <div className="mt-row flex flex-wrap gap-inline">
        <Button
          variant="primary"
          size="sm"
          disabled={pending || !evidenced}
          title={evidenced ? undefined : missingEvidence}
          onClick={() => run("passed")}
        >
          Passed
        </Button>
        <Button
          variant="dangerQuiet"
          size="sm"
          disabled={pending || !canFail}
          title={canFail ? undefined : "Say what did not check out first"}
          onClick={() => run("failed")}
        >
          Did not pass
        </Button>
      </div>
      {!evidenced && missingEvidence && <p className="nf-caption mt-row">{missingEvidence}</p>}
      <Refusal message={error} />
    </div>
  );
}
