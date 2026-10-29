"use client";

import { useState } from "react";
import type { Dictionary } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { DragToConfirm } from "@/components/ui/DragToConfirm";
import {
  approveStr,
  decideStr,
  holdStrSubject,
  linkStr,
  releaseStrHold,
  approveStrRelease,
  openStrCase,
  recordStrFiling,
} from "@/lib/admin/str-actions";
import {
  STR_LINK_KINDS,
  STR_SOURCES,
  lagosLocalToIso,
  lagosTime,
  type StrCase,
  type StrSource,
} from "@/lib/admin/str";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

/**
 * SCUML item 6: the STR lane's controls. Every button calls a server action
 * that calls a definer function; the database enforces who may do what.
 * Staff only.
 */

type Copy = Dictionary["complianceStr"];
/**
 * The words the one slide on this lane carries, built on the server from the
 * shared labels and the console's copy so this client file never reads a
 * dictionary of its own and never writes a label.
 */
export type StrSlideWords = {
  slideApprove: string;
  confirming: string;
  confirmed: string;
  error: string;
  decisionBar: string;
  /** The slide that ends a hold: a second person's release is as final as an approval. */
  slideApproveRelease: string;
};
type Said = { ok: boolean; text: string } | null;

function Message({ said }: { said: Said }) {
  if (!said || !said.text) return null;
  return (
    <p
      role={said.ok ? "status" : "alert"}
      className={`nf-body-sm mt-inline ${
        said.ok
          ? "text-[var(--nf-content-primary)]"
          : "text-[var(--nf-state-error)]"
      }`}
    >
      {said.text}
    </p>
  );
}

const field = "nf-field w-full";
const label = "nf-body-sm text-[var(--nf-content-secondary)]";

export function StrOpenForm({
  copy,
  prefill,
}: {
  copy: Copy;
  prefill: { from: StrSource; id: string; subject: string };
}) {
  const [from, setFrom] = useState<StrSource>(prefill.from);
  const [sourceId, setSourceId] = useState(prefill.id);
  const [subject, setSubject] = useState(prefill.subject);
  const [grounds, setGrounds] = useState("");
  const [said, setSaid] = useState<Said>(null);
  const [pending, start] = useSafeTransition();

  function submit() {
    setSaid(null);
    start(async () => {
      const result = await openStrCase({
        sourceKind: from,
        sourceId,
        subjectId: subject,
        grounds,
      });
      if (!result.ok) return setSaid({ ok: false, text: result.error });
      const due =
        (result.data.data as { due_at?: string } | null)?.due_at ?? "";
      setSaid({ ok: true, text: copy.opened.replace("{due}", lagosTime(due)) });
      setGrounds("");
    });
  }

  return (
    <form
      className="grid gap-row"
      data-testid="str-open"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label className="grid gap-inline-tight">
        <span className={label}>{copy.sourceKind}</span>
        <select
          className={field}
          value={from}
          onChange={(e) => setFrom(e.target.value as StrSource)}
        >
          {STR_SOURCES.map((s) => (
            <option key={s} value={s}>
              {copy.sources[s]}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-inline-tight">
        <span className={label}>{copy.sourceId}</span>
        <input
          className={field}
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value)}
          required
          maxLength={200}
        />
      </label>
      {from !== "person" && (
        <label className="grid gap-inline-tight">
          <span className={label}>{copy.subject}</span>
          <input
            className={field}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={36}
          />
        </label>
      )}
      <label className="grid gap-inline-tight">
        <span className={label}>{copy.grounds}</span>
        <textarea
          className={`${field} min-h-[7rem]`}
          value={grounds}
          onChange={(e) => setGrounds(e.target.value)}
          required
          minLength={20}
          maxLength={8000}
        />
        <span className="nf-caption">{copy.groundsHint}</span>
      </label>
      <Button type="submit" variant="primary" full loading={pending}>
        {pending ? copy.opening : copy.open}
      </Button>
      <Message said={said} />
    </form>
  );
}

export function StrCaseControls({ copy, c, words }: { copy: Copy; c: StrCase; words: StrSlideWords }) {
  const [said, setSaid] = useState<Said>(null);
  const [pending, start] = useSafeTransition();
  const [reasons, setReasons] = useState("");
  const [note, setNote] = useState("");
  const [reference, setReference] = useState("");
  const [filedAt, setFiledAt] = useState("");
  const [linkKind, setLinkKind] =
    useState<(typeof STR_LINK_KINDS)[number]>("transaction");
  const [linkRef, setLinkRef] = useState("");
  const [releaseNote, setReleaseNote] = useState("");
  /* True from the moment the approval slide is released until the server has
     answered, so the other way out of the same decision cannot be taken
     while this one is in flight. */
  const [ruling, setRuling] = useState(false);

  function run(
    action: () => Promise<
      { ok: true; data: { text: string } } | { ok: false; error: string }
    >
  ) {
    setSaid(null);
    start(async () => {
      const result = await action();
      setSaid(
        result.ok
          ? { ok: true, text: result.data.text }
          : { ok: false, text: result.error }
      );
    });
  }

  /*
   * THE ONE RULING THAT CANNOT BE TAKEN BACK. A second person's approval is
   * recorded once and never revised, so it is a slide, and the track says
   * "confirmed" only after the server has said so: this resolves false on a
   * refusal, and the refusal's own sentence is printed under it. Sending a
   * decision back reopens the case, so that stays a button.
   */
  async function rule(
    action: () => Promise<{ ok: true; data: { text: string } } | { ok: false; error: string }>,
  ): Promise<boolean> {
    setSaid(null);
    setRuling(true);
    try {
      const result = await action();
      setSaid(result.ok ? { ok: true, text: result.data.text } : { ok: false, text: result.error });
      return result.ok;
    } finally {
      setRuling(false);
    }
  }

  return (
    <div className="mt-row grid gap-row">
      {c.state === "open" && (
        <div className="grid gap-inline" data-testid="str-decide">
          <label className="grid gap-inline-tight">
            <span className={label}>{copy.reasons}</span>
            <textarea
              className={`${field} min-h-[5rem]`}
              value={reasons}
              onChange={(e) => setReasons(e.target.value)}
              maxLength={8000}
            />
            <span className="nf-caption">{copy.reasonsHint}</span>
          </label>
          {/* The decision bar: on a phone it stays above the home indicator
              while the grounds above it are read. A decision here is a
              proposal a second person must approve, so it is a button. */}
          <div className="nf-admin-decision" role="group" aria-label={words.decisionBar}>
            <div className="nf-admin-decision__buttons grid gap-inline sm:grid-cols-2">
              <Button
                variant="danger"
                disabled={pending}
                onClick={() => run(() => decideStr({ caseId: c.id, decision: "file", reasons }))}
              >
                {copy.decisionFile}
              </Button>
              <Button
                variant="secondary"
                disabled={pending}
                onClick={() => run(() => decideStr({ caseId: c.id, decision: "no_file", reasons }))}
              >
                {copy.decisionNoFile}
              </Button>
            </div>
          </div>
        </div>
      )}

      {c.state === "awaiting_approval" && c.decision && (
        <div className="grid gap-inline" data-testid="str-approve">
          <p className="nf-caption">{copy.secondPerson}</p>
          <label className="grid gap-inline-tight">
            <span className={label}>{copy.approveNote}</span>
            <input
              className={field}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={4000}
            />
          </label>
          <div className="nf-admin-decision" role="group" aria-label={words.decisionBar}>
            <div className="nf-admin-decision__buttons grid gap-inline">
              <DragToConfirm
                label={words.slideApprove}
                keyboardLabel={copy.approve}
                confirmingLabel={words.confirming}
                confirmedLabel={words.confirmed}
                errorLabel={words.error}
                disabled={pending}
                onConfirm={() => rule(() => approveStr({ decisionId: c.decision!.id, approve: true, note }))}
                data-testid="str-approve-slide"
              />
              <Button
                variant="secondary"
                disabled={pending || ruling}
                onClick={() => run(() => approveStr({ decisionId: c.decision!.id, approve: false, note }))}
              >
                {copy.reject}
              </Button>
            </div>
          </div>
        </div>
      )}

      {c.state === "to_file" && (
        <div className="grid gap-inline" data-testid="str-record">
          <label className="grid gap-inline-tight">
            <span className={label}>{copy.goaml}</span>
            <input
              className={field}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              maxLength={200}
            />
          </label>
          <label className="grid gap-inline-tight">
            <span className={label}>{copy.filedAt}</span>
            <input
              className={field}
              type="datetime-local"
              value={filedAt}
              onChange={(e) => setFiledAt(e.target.value)}
            />
          </label>
          <div className="nf-admin-decision">
            <Button
              variant="primary"
              full
              disabled={pending || !lagosLocalToIso(filedAt)}
              onClick={() =>
                run(() =>
                  recordStrFiling({
                    caseId: c.id,
                    reference,
                    filedAt: lagosLocalToIso(filedAt) ?? "",
                  })
                )
              }
            >
              {copy.recordFiling}
            </Button>
          </div>
        </div>
      )}

      {(c.state === "open" ||
        c.state === "awaiting_approval" ||
        c.state === "to_file") && (
        <div
          className="grid gap-inline sm:grid-cols-[10rem_1fr_auto] sm:items-end"
          data-testid="str-link"
        >
          <label className="grid gap-inline-tight">
            <span className={label}>{copy.linkKind}</span>
            <select
              className={field}
              value={linkKind}
              onChange={(e) => setLinkKind(e.target.value as typeof linkKind)}
            >
              {STR_LINK_KINDS.map((k) => (
                <option key={k} value={k}>
                  {copy.linkKinds[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-inline-tight">
            <span className={label}>{copy.linkRef}</span>
            <input
              className={field}
              value={linkRef}
              onChange={(e) => setLinkRef(e.target.value)}
              maxLength={200}
            />
          </label>
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => run(() => linkStr({ caseId: c.id, kind: linkKind, ref: linkRef }))}
          >
            {copy.link}
          </Button>
        </div>
      )}

      {c.subjectId && (
        <div
          className="grid gap-inline"
          data-testid="str-hold"
        >
          {c.state !== "not_filed" && (
            <>
              {/* Holding does not move money: it stops a payout account being
                  added or changed, and a second person ends it. So it is a
                  danger button, not a money slide. */}
              <Button variant="danger" disabled={pending} onClick={() => run(() => holdStrSubject({ caseId: c.id }))}>
                {copy.hold}
              </Button>
              <p className="nf-caption">{copy.holdHint}</p>
            </>
          )}
          <label className="grid gap-inline-tight">
            <span className={label}>{copy.releaseNote}</span>
            <input
              className={field}
              value={releaseNote}
              onChange={(e) => setReleaseNote(e.target.value)}
              maxLength={2000}
            />
          </label>
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => run(() => releaseStrHold({ caseId: c.id, note: releaseNote }))}
          >
            {copy.release}
          </Button>
        </div>
      )}

      {pending && (
        <p className="nf-caption" role="status">
          {copy.working}
        </p>
      )}
      <Message said={said} />
    </div>
  );
}

/**
 * SCUML items 6 and 19: the second person on a hold release. Ending a hold is
 * as final as approving a decision (it is recorded once, by a second person),
 * so it is the same slide: not the money one, because ending a hold moves no
 * money, and resolving false on a refusal, with the refusal's own sentence
 * printed beneath.
 */
export function StrApproveRelease({ copy, releaseId, words }: { copy: Copy; releaseId: string; words: StrSlideWords }) {
  const [said, setSaid] = useState<Said>(null);
  return (
    <div className="mt-row">
      <DragToConfirm
        label={words.slideApproveRelease}
        keyboardLabel={copy.approveRelease}
        confirmingLabel={words.confirming}
        confirmedLabel={words.confirmed}
        errorLabel={words.error}
        onConfirm={async () => {
          setSaid(null);
          const result = await approveStrRelease({ releaseId });
          setSaid(result.ok ? { ok: true, text: result.data.text } : { ok: false, text: result.error });
          return result.ok;
        }}
        data-testid="str-release-slide"
      />
      <Message said={said} />
    </div>
  );
}
