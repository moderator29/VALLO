"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Dictionary } from "@vallo/i18n/core";
import {
  activateSanctionsList,
  approveSanctionsDecision,
  proposeSanctionsDecision,
  rejectSanctionsDecision,
  type DeskAnswer,
} from "@/lib/compliance/sanctions/actions";
import type { SanctionsHit, WaitingList } from "@/lib/compliance/sanctions/desk";
import { Button } from "@/components/ui/Button";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

type Copy = Dictionary["compliance"]["sanctions"];

/** Load a list file (SCUML items 8, 9) through the upload route; it waits for a second person. */
export function SanctionsUpload({ copy }: { copy: Copy }) {
  const router = useRouter();
  const [answer, setAnswer] = useState<DeskAnswer | null>(null);
  const [pending, start] = useSafeTransition();
  const act = (form: FormData) =>
    start(async () => {
      try {
        const file = form.get("file");
        if (file instanceof File && file.size > 4 * 1024 * 1024) {
          setAnswer({ ok: false, error: "too_large" });
          return;
        }
        const response = await fetch("/api/compliance/sanctions-upload", { method: "POST", body: form }).catch(() => null);
        const body = (await response?.json().catch(() => null)) as DeskAnswer | null;
        setAnswer(body ?? { ok: false, error: "failed" });
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  const said =
    answer === null
      ? null
      : answer.ok
        ? answer.message === "same"
          ? copy.uploadSame
          : answer.message.startsWith("waiting:")
            ? copy.uploadWaiting.replace("{count}", answer.message.replace("waiting:", ""))
            : copy.uploadDone.replace("{count}", answer.message.replace("loaded:", ""))
        : answer.error === "too_large"
          ? copy.uploadTooLarge
          : answer.error === "incomplete"
            ? copy.refusedIncomplete
            : copy.uploadFailed;
  return (
    <form action={act} className="mt-group">
      <h3 className="nf-overline">{copy.upload}</h3>
      <p className="nf-caption mt-inline">{copy.uploadHelp}</p>
      <label className="nf-body-sm mt-row block">
        {copy.uploadSource}{" "}
        <select name="source" defaultValue="un" className="nf-admin-select">
          <option value="un">{copy.sourceUn}</option>
          <option value="ng">{copy.sourceNg}</option>
        </select>
      </label>
      <label className="nf-body-sm mt-row block">
        {copy.uploadFile} <input type="file" name="file" accept=".xml,.csv,text/xml,text/csv" required />
      </label>
      <div className="mt-row">
        <Button type="submit" variant="secondary" loading={pending}>
          {copy.uploadGo}
        </Button>
      </div>
      {said && (
        <p className="nf-body-sm mt-row" role={answer?.ok ? "status" : "alert"}>
          {said}
        </p>
      )}
    </form>
  );
}

/** A refusal's own sentence; anything unrecognised is "not recorded". */
export function deskRefusal(copy: Copy, code: string): string {
  switch (code) {
    case "superseded":
      return copy.refusedSuperseded;
    case "own_case":
      return copy.refusedOwnCase;
    case "own_proposal":
      return copy.refusedOwnProposal;
    case "own_upload":
      return copy.ownUpload;
    case "incomplete":
      return copy.refusedIncomplete;
    default:
      return copy.decisionFailed;
  }
}

function useDeskRun(copy: Copy) {
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useSafeTransition();
  const run = (work: () => Promise<DeskAnswer>) =>
    start(async () => {
      try {
        setError(null);
        setNote(null);
        const answer = await work().catch(() => ({ ok: false as const, error: "failed" }));
        if (!answer.ok) setError(deskRefusal(copy, answer.error));
        else if (answer.message === "proposed") setNote(copy.listProposed);
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  return { error, note, pending, run };
}

/** A waiting list version, activated by somebody other than who loaded it (items 9 and 19). */
export function SanctionsActivate({ copy, list, me }: { copy: Copy; list: WaitingList; me: string }) {
  const { error, note, pending, run } = useDeskRun(copy);
  /* Loaded by me (an upload), or proposed by me (a short list from its URL): a second person acts. */
  if (list.loadedBy === me) return <p className="nf-caption mt-inline">{copy.ownUpload}</p>;
  if (list.proposedBy === me) return <p className="nf-caption mt-inline">{copy.ownListProposal}</p>;
  return (
    <div className="mt-inline">
      <Button variant="secondary" loading={pending} onClick={() => run(() => activateSanctionsList({ versionId: list.id }))}>
        {copy.activate}
      </Button>
      {note && <p className="nf-caption" role="status">{note}</p>}
      {error && <p className="nf-caption" role="alert">{error}</p>}
    </div>
  );
}

/** Propose, or approve or reject somebody else's proposal (SCUML item 19). */
export function SanctionsDecision({ copy, hit, me }: { copy: Copy; hit: SanctionsHit; me: string }) {
  const [note, setNote] = useState("");
  const { error, pending, run } = useDeskRun(copy);

  if (hit.pending) {
    const decision =
      hit.pending.decision === "confirm" ? copy.proposeConfirm : hit.pending.decision === "release" ? copy.proposeRelease : copy.proposeClear;
    return (
      <div className="mt-row">
        <p className="nf-body-sm">{copy.proposed.replace("{who}", hit.pending.proposedBy === me ? copy.byYou : copy.byColleague).replace("{decision}", decision)}</p>
        <p className="nf-caption">{hit.pending.note}</p>
        {hit.pending.proposedBy === me ? (
          <p className="nf-caption mt-inline">{copy.ownProposal}</p>
        ) : (
          <div className="mt-inline flex flex-wrap gap-inline">
            <Button variant="primary" loading={pending} onClick={() => run(() => approveSanctionsDecision({ decisionId: hit.pending!.id }))}>
              {copy.approve}
            </Button>
            <Button variant="ghost" disabled={pending} onClick={() => run(() => rejectSanctionsDecision({ decisionId: hit.pending!.id }))}>
              {copy.reject}
            </Button>
          </div>
        )}
        {error && <p className="nf-caption" role="alert">{error}</p>}
      </div>
    );
  }

  if (hit.status === "confirmed") {
    return (
      <div className="mt-row">
        <textarea className="nf-field w-full resize-y" rows={2} maxLength={2000} placeholder={copy.releaseNote} value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="mt-inline">
          <Button variant="secondary" disabled={pending || note.trim().length < 3} onClick={() => run(() => proposeSanctionsDecision({ hitId: hit.id, decision: "release", note }))}>
            {copy.proposeRelease}
          </Button>
        </div>
        {error && <p className="nf-caption" role="alert">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-row">
      <textarea className="nf-field w-full resize-y" rows={2} maxLength={2000} placeholder={copy.notePlaceholder} value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="mt-inline flex flex-wrap gap-inline">
        <Button variant="secondary" disabled={pending || note.trim().length < 3} onClick={() => run(() => proposeSanctionsDecision({ hitId: hit.id, decision: "clear", note }))}>
          {copy.proposeClear}
        </Button>
        <Button variant="danger" disabled={pending || note.trim().length < 3} onClick={() => run(() => proposeSanctionsDecision({ hitId: hit.id, decision: "confirm", note }))}>
          {copy.proposeConfirm}
        </Button>
      </div>
      {error && <p className="nf-caption" role="alert">{error}</p>}
    </div>
  );
}
