"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { NairaField } from "@/components/ui/NairaField";
import { TextArea, TextField } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import {
  acceptCounter,
  acceptOffer,
  answerInformationRequest,
  counterOffer,
  declineOffer,
  markStage,
  raiseDealDispute,
  requestMoreInformation,
  withdrawOffer,
} from "@/lib/offers/actions";
import { resolveAmount, proposedDate } from "@/lib/offers/format";
import { AGREED_IS_NOT_SALE, NO_MONEY_TAKEN, PAYMENT_LABEL, doorSentence } from "@/lib/offers/words";
import type { DealRoom, PaymentPreference } from "@/lib/offers/types";
import { OfferFigures, Facts } from "@/components/app/offers/OfferParts";
import { newKey, useAct } from "./act";
import { RECORD_STAGE_BUTTON, latestVersion } from "./model";

export type SheetKind = "respond" | "decide_counter" | "accept" | "decline" | "counter" | "info" | "answer" | "withdraw" | "stage" | "dispute";

type StageTarget = "due_diligence" | "documentation" | "closing" | "completed";

/**
 * Every sheet the Deal Room opens. One component so each form mounts fresh when
 * its sheet opens: the idempotency key is made once per mount, so a double tap
 * or a retry cannot do the thing twice.
 */
export function DealSheets({
  room,
  kind,
  stage,
  onKind,
  onClose,
}: {
  room: DealRoom;
  kind: SheetKind | null;
  stage: StageTarget | null;
  onKind: (kind: SheetKind) => void;
  onClose: () => void;
}) {
  const open = kind !== null;
  const titles: Record<SheetKind, string> = {
    respond: "Respond to this offer",
    decide_counter: "Respond to the counteroffer",
    accept: "Accept these terms",
    decline: "Decline this offer",
    counter: "Propose new terms",
    info: "Ask the buyer a question",
    answer: "Answer the question",
    withdraw: "Withdraw your offer",
    stage: stage ? RECORD_STAGE_BUTTON[stage] : "Record a step",
    dispute: "Raise a concern",
  };
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()} title={kind ? titles[kind] : "Deal Room"} detents={[0.92]} testId="deal-sheet">
      {kind === "respond" ? <ChoiceSheet room={room} onKind={onKind} /> : null}
      {kind === "decide_counter" ? <ChoiceSheet room={room} onKind={onKind} counter /> : null}
      {kind === "accept" ? <AcceptForm room={room} onDone={onClose} /> : null}
      {kind === "decline" ? <DeclineForm room={room} onDone={onClose} /> : null}
      {kind === "counter" ? <CounterForm room={room} onDone={onClose} /> : null}
      {kind === "info" ? <QuestionForm room={room} onDone={onClose} /> : null}
      {kind === "answer" ? <AnswerForm room={room} onDone={onClose} /> : null}
      {kind === "withdraw" ? <WithdrawForm room={room} onDone={onClose} /> : null}
      {kind === "stage" && stage ? <StageForm room={room} stage={stage} onDone={onClose} /> : null}
      {kind === "dispute" ? <DisputeForm room={room} onDone={onClose} /> : null}
    </Sheet>
  );
}

function ChoiceSheet({ room, onKind, counter = false }: { room: DealRoom; onKind: (k: SheetKind) => void; counter?: boolean }) {
  const v = latestVersion(room);
  return (
    <div className="grid gap-md pb-lg">
      {v ? <OfferFigures amountMinor={v.amountMinor} askingMinor={room.offer.askingMinor} label={`Version ${v.version}`} /> : null}
      <ListGroup>
        <ListRow title={counter ? "Accept the counteroffer" : "Accept"} sub="Agree these exact terms. This is not yet a sale." chevron onClick={() => onKind("accept")} data-testid="choice-accept" />
        <ListRow title="Counteroffer" sub="Propose new terms. Your proposal becomes a new version." chevron onClick={() => onKind("counter")} data-testid="choice-counter" />
        {counter ? (
          <ListRow title="Withdraw my offer" sub="End the offer. You can offer again later." chevron onClick={() => onKind("withdraw")} data-testid="choice-withdraw" />
        ) : (
          <>
            <ListRow title="Request more information" sub="Ask the buyer a question before you decide." chevron onClick={() => onKind("info")} data-testid="choice-info" />
            <ListRow title="Decline" sub="Close the offer. You can give a reason." chevron onClick={() => onKind("decline")} data-testid="choice-decline" />
          </>
        )}
      </ListGroup>
    </div>
  );
}

function AcceptForm({ room, onDone }: { room: DealRoom; onDone: () => void }) {
  const [key] = useState(newKey);
  const { pending, run } = useAct();
  const v = latestVersion(room);
  if (!v) return null;
  const seller = room.viewerSide === "seller";
  const go = () =>
    run(
      () => (seller ? acceptOffer({ offerId: room.offer.id, version: v.version, idempotencyKey: key }) : acceptCounter({ offerId: room.offer.id, version: v.version, idempotencyKey: key })),
      "Terms recorded. This is not yet a sale.",
      onDone,
    );
  return (
    <div className="grid gap-md pb-lg">
      <p className="nf-body">
        You are accepting <strong>version {v.version}</strong>, proposed by {v.proposedBy === room.viewerSide ? "you" : v.proposedBy === "buyer" ? "the buyer" : "the seller"}. Nothing else can change these terms.
      </p>
      <OfferFigures amountMinor={v.amountMinor} askingMinor={room.offer.askingMinor} label="Agreed figure" />
      <Facts items={[{ label: "Payment", value: PAYMENT_LABEL[v.terms.paymentPreference] }, { label: "Closing", value: proposedDate(v.terms.targetClosing) }]} />
      <p className="nf-body-sm text-[var(--nf-content-muted)]">{AGREED_IS_NOT_SALE}</p>
      <p className="nf-body-sm text-[var(--nf-content-muted)]">{NO_MONEY_TAKEN}</p>
      <Button variant="primary" size="lg" full loading={pending} onClick={() => void go()} data-testid="confirm-accept">
        Accept these terms
      </Button>
    </div>
  );
}

function DeclineForm({ room, onDone }: { room: DealRoom; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const { pending, run } = useAct();
  return (
    <div className="grid gap-md pb-lg">
      <TextArea label="Reason" optionalText="Optional" value={reason} maxLength={500} rows={4} onChange={(e) => setReason(e.target.value)} hint="The buyer reads this." />
      <Button variant="danger" size="lg" full loading={pending} onClick={() => void run(() => declineOffer({ offerId: room.offer.id, reason: reason.trim() || null }), "Offer declined.", onDone)} data-testid="confirm-decline">
        Decline offer
      </Button>
    </div>
  );
}

function CounterForm({ room, onDone }: { room: DealRoom; onDone: () => void }) {
  const [key] = useState(newKey);
  const v = latestVersion(room);
  const [amount, setAmount] = useState("");
  const [pref, setPref] = useState<PaymentPreference>(v?.terms.paymentPreference ?? "cash");
  const [closing, setClosing] = useState(v?.terms.targetClosing ?? "");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | undefined>();
  const { pending, run } = useAct();
  const parsed = resolveAmount(amount, room.offer.askingMinor);
  const typed = amount.trim() !== "" && parsed.ok;
  return (
    <div className="grid gap-md pb-lg">
      <p className="nf-body text-[var(--nf-content-secondary)]">
        Your proposal becomes a new version. The version before it is kept as it was.
      </p>
      <NairaField label="New figure" value={amount} onValueChange={(x) => { setError(undefined); setAmount(x); }} error={error} required data-testid="counter-amount" />
      {typed && parsed.ok ? <OfferFigures amountMinor={parsed.minor} askingMinor={room.offer.askingMinor} label="You would propose" /> : null}
      <div className="grid gap-xs">
        <p className="nf-section-label">Payment</p>
        <Segmented label="Payment preference" semantics="radio" full value={pref} onChange={setPref} options={[{ value: "cash", label: "Cash" }, { value: "mortgage", label: "Mortgage" }, { value: "instalment", label: "Instalment" }]} />
      </div>
      <TextField label="Proposed closing date" optionalText="Optional" type="date" value={closing} onChange={(e) => setClosing(e.target.value)} />
      <TextArea label="Note" optionalText="Optional" value={note} maxLength={600} rows={3} onChange={(e) => setNote(e.target.value)} />
      <Button
        variant="primary"
        size="lg"
        full
        loading={pending}
        data-testid="confirm-counter"
        onClick={() => {
          if (amount.trim() === "" || !parsed.ok) {
            setError(parsed.ok ? "Enter the figure you propose." : doorSentence(parsed.reason));
            return;
          }
          void run(() => counterOffer({ offerId: room.offer.id, baseVersion: room.offer.version, amountNaira: amount, paymentPreference: pref, targetClosing: closing || null, note: note.trim() || null, idempotencyKey: key }), "Your proposal was sent as a new version.", onDone);
        }}
      >
        Send proposal
      </Button>
    </div>
  );
}

function QuestionForm({ room, onDone }: { room: DealRoom; onDone: () => void }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | undefined>();
  const { pending, run } = useAct();
  return (
    <div className="grid gap-md pb-lg">
      <TextArea label="Your question" value={text} maxLength={500} rows={4} error={error} onChange={(e) => { setError(undefined); setText(e.target.value); }} required />
      <Button variant="primary" size="lg" full loading={pending} data-testid="confirm-info" onClick={() => (text.trim() ? void run(() => requestMoreInformation({ offerId: room.offer.id, question: text.trim() }), "Your question was sent.", onDone) : setError("Write your question first."))}>
        Send question
      </Button>
    </div>
  );
}

function AnswerForm({ room, onDone }: { room: DealRoom; onDone: () => void }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | undefined>();
  const { pending, run } = useAct();
  return (
    <div className="grid gap-md pb-lg">
      <TextArea label="Your answer" value={text} maxLength={500} rows={4} error={error} onChange={(e) => { setError(undefined); setText(e.target.value); }} required />
      <Button variant="primary" size="lg" full loading={pending} data-testid="confirm-answer" onClick={() => (text.trim() ? void run(() => answerInformationRequest({ offerId: room.offer.id, answer: text.trim() }), "Your answer was sent.", onDone) : setError("Write your answer first."))}>
        Send answer
      </Button>
    </div>
  );
}

function WithdrawForm({ room, onDone }: { room: DealRoom; onDone: () => void }) {
  const { pending, run } = useAct();
  return (
    <div className="grid gap-md pb-lg">
      <p className="nf-body">Withdrawing ends this offer. The history stays on record. You can make a new offer later.</p>
      <Button variant="danger" size="lg" full loading={pending} onClick={() => void run(() => withdrawOffer({ offerId: room.offer.id }), "Offer withdrawn.", onDone)} data-testid="confirm-withdraw">
        Withdraw offer
      </Button>
    </div>
  );
}

function StageForm({ room, stage, onDone }: { room: DealRoom; stage: StageTarget; onDone: () => void }) {
  const { pending, run } = useAct();
  return (
    <div className="grid gap-md pb-lg">
      <p className="nf-body">
        {stage === "completed"
          ? "Record that you consider this deal completed. Vallo took no money and does not mark a property as sold. The other side confirms for themselves."
          : "This records a step you have reached. It does not complete anything on its own, and it is kept in the activity."}
      </p>
      <Button variant="primary" size="lg" full loading={pending} onClick={() => void run(() => markStage({ offerId: room.offer.id, stage }), "Step recorded.", onDone)} data-testid="confirm-stage">
        {RECORD_STAGE_BUTTON[stage]}
      </Button>
    </div>
  );
}

function DisputeForm({ room, onDone }: { room: DealRoom; onDone: () => void }) {
  const [reason, setReason] = useState("misrepresented");
  const [detail, setDetail] = useState("");
  const [error, setError] = useState<string | undefined>();
  const { pending, run } = useAct();
  return (
    <div className="grid gap-md pb-lg">
      <p className="nf-body text-[var(--nf-content-secondary)]">Raising a concern sends this deal to Vallo&apos;s trust and safety team. It does not change the agreed terms.</p>
      <Segmented
        label="What is the concern about"
        semantics="radio"
        stack
        full
        value={reason}
        onChange={setReason}
        options={[
          { value: "misrepresented", label: "The property or the terms were misrepresented" },
          { value: "no_authority", label: "The seller or agent may have no right to sell" },
          { value: "pressure", label: "I am being pressed to pay outside Vallo" },
          { value: "other", label: "Something else" },
        ]}
      />
      <TextArea label="What happened" value={detail} maxLength={800} rows={4} error={error} onChange={(e) => { setError(undefined); setDetail(e.target.value); }} required />
      <Button variant="primary" size="lg" full loading={pending} data-testid="confirm-dispute" onClick={() => (detail.trim() ? void run(() => raiseDealDispute({ offerId: room.offer.id, reason, detail: detail.trim() }), "Your concern was sent to Vallo.", onDone) : setError("Tell us what happened."))}>
        Send concern
      </Button>
    </div>
  );
}
