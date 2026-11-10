"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { banner } from "@/lib/ui/toast";
import type { ActionResult } from "@/lib/actions/envelope";
import {
  confirmProtected,
  newProtectedDetails,
  raiseProtectedProblem,
  refreshProtected,
  reportProtectedTransfer,
} from "@/lib/money/protected-actions";
import {
  PROTECTED_ACTION_REFUSED,
  PROTECTED_NOT_YET,
  PROTECTED_PROBLEM_DRAFT_KEPT,
  PROTECTED_PROBLEM_LEAD,
  PROTECTED_PROBLEM_REASONS,
  PROTECTED_PROBLEM_REASON_LABEL,
  PROTECTED_PROBLEM_SENT,
  PROTECTED_PROBLEM_STATEMENT_HINT,
  PROTECTED_PROBLEM_STATEMENT_LABEL,
  PROTECTED_PROBLEM_SUBMIT,
  PROTECTED_PROBLEM_TITLE,
} from "@/lib/money/copy";
import { ProtectedPayment } from "./ProtectedPayment";
import type { ProtectedDeal } from "./types";

type Reason = keyof typeof PROTECTED_PROBLEM_REASONS;
const REASONS = Object.keys(PROTECTED_PROBLEM_REASONS) as Reason[];

/** The device-only draft key: a drafted statement is never lost when the app closes (spec, weak network). */
const draftKey = (arrangementId: string) => `nf-pp-problem:${arrangementId}`;

function readDraft(key: string): { reason: Reason | null; statement: string } {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return { reason: null, statement: "" };
    const parsed = JSON.parse(raw) as { reason?: unknown; statement?: unknown };
    return {
      reason: typeof parsed.reason === "string" && (REASONS as string[]).includes(parsed.reason) ? (parsed.reason as Reason) : null,
      statement: typeof parsed.statement === "string" ? parsed.statement.slice(0, 2000) : "",
    };
  } catch {
    return { reason: null, statement: "" };
  }
}

function writeDraft(key: string, value: { reason: Reason | null; statement: string } | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* A browser that refuses storage still sends the report; only the draft is not kept. */
  }
}

/**
 * The protected payment screens on a real page: the lead's `ProtectedPayment`
 * with its five actions bound to the server (`lib/money/protected-actions.ts`).
 * Every action only ASKS; the page then reads the recorded state again
 * (`router.refresh()`), and the screen follows that state, never the press.
 * A refusal is said in the banner, in plain words, and changes nothing.
 */
export function ProtectedPaymentLive({
  deal,
  now,
  locale,
  agreementId,
  arrangementId,
}: {
  deal: ProtectedDeal;
  now: number;
  locale: Locale;
  agreementId: string;
  arrangementId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [problemOpen, setProblemOpen] = useState(false);
  const target = { agreementId, arrangementId };

  const run = <T,>(act: () => Promise<ActionResult<T>>, done?: (data: T) => void) => () =>
    start(async () => {
      try {
        const result = await act();
        if (!result.ok) banner.error(result.error);
        else done?.(result.data);
      } catch {
        banner.error(PROTECTED_ACTION_REFUSED.unavailable);
      }
      router.refresh();
    });

  return (
    <>
      <ProtectedPayment
        deal={deal}
        now={now}
        locale={locale}
        pending={pending}
        actions={{
          refresh: run(() => refreshProtected(target)),
          reportTransfer: run(() => reportProtectedTransfer(target)),
          confirmMilestone: run(() => confirmProtected(target)),
          raiseProblem: () => setProblemOpen(true),
          newDetails: run(() => newProtectedDetails(target)),
        }}
      />
      <ProblemSheet
        open={problemOpen}
        onOpenChange={setProblemOpen}
        arrangementId={arrangementId}
        pending={pending}
        onSubmit={(reason, statement, sent) =>
          run(
            () => raiseProtectedProblem({ ...target, reason, statement }),
            () => {
              sent();
              banner.success(PROTECTED_PROBLEM_SENT);
            },
          )()
        }
      />
    </>
  );
}

/**
 * "Something isn't right?" (spec screen 8): a reason, the payer's own words,
 * and a send. The draft is kept on the device until it is sent; once sent it
 * is never edited (new evidence is a new entry, recorded by the server).
 */
export function ProblemSheet(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  arrangementId: string;
  pending: boolean;
  onSubmit: (reason: Reason, statement: string, sent: () => void) => void;
}) {
  /* Remounted on each opening, so the kept draft is read fresh then. */
  return <ProblemSheetBody key={props.open ? "open" : "closed"} {...props} />;
}

function ProblemSheetBody({
  open,
  onOpenChange,
  arrangementId,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  arrangementId: string;
  pending: boolean;
  onSubmit: (reason: Reason, statement: string, sent: () => void) => void;
}) {
  const key = draftKey(arrangementId);
  const [draft] = useState(() => (open ? readDraft(key) : { reason: null, statement: "" }));
  const [reason, setReason] = useState<Reason | null>(draft.reason);
  const [statement, setStatement] = useState(draft.statement);
  const name = useId();

  const keep = (next: { reason: Reason | null; statement: string }) => {
    setReason(next.reason);
    setStatement(next.statement);
    writeDraft(key, next);
  };
  const ready = reason !== null && statement.trim().length >= 10;

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={PROTECTED_PROBLEM_TITLE}
      description={PROTECTED_PROBLEM_LEAD}
      closeLabel={PROTECTED_NOT_YET}
      testId="pp-problem-sheet"
      footer={
        <div className="nf-pp-actions">
          <Button
            variant="primary"
            size="lg"
            full
            disabled={!ready || pending}
            loading={pending}
            data-testid="pp-problem-submit"
            onClick={() =>
              reason &&
              onSubmit(reason, statement.trim(), () => {
                writeDraft(key, null);
                setReason(null);
                setStatement("");
                onOpenChange(false);
              })
            }
          >
            {PROTECTED_PROBLEM_SUBMIT}
          </Button>
          <Button variant="secondary" size="lg" full onClick={() => onOpenChange(false)}>
            {PROTECTED_NOT_YET}
          </Button>
        </div>
      }
    >
      <div className="nf-pp-screen">
        <fieldset className="nf-pp-reasons">
          <legend>{PROTECTED_PROBLEM_REASON_LABEL}</legend>
          {REASONS.map((r) => (
            <label key={r} className="nf-pp-reason" data-on={reason === r || undefined}>
              <input type="radio" name={name} value={r} className="sr-only" checked={reason === r} onChange={() => keep({ reason: r, statement })} />
              <span className="nf-pp-reason__dot" aria-hidden="true" />
              {PROTECTED_PROBLEM_REASONS[r]}
            </label>
          ))}
        </fieldset>
        <TextArea
          label={PROTECTED_PROBLEM_STATEMENT_LABEL}
          hint={PROTECTED_PROBLEM_STATEMENT_HINT}
          value={statement}
          maxLength={2000}
          rows={5}
          onChange={(e) => keep({ reason, statement: e.currentTarget.value })}
          data-testid="pp-problem-statement"
        />
        <p className="nf-pp-fine">{PROTECTED_PROBLEM_DRAFT_KEPT}</p>
      </div>
    </Sheet>
  );
}
