"use client";

import { banner } from "@/lib/ui/toast";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Locale } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { DragToConfirm } from "@/components/ui/DragToConfirm";
import { TextField } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { StepFrame } from "@/components/ui/StepFrame";
import { cancelBalanceMovement, confirmBalanceMovement, findBalanceRecipient, prepareSend, type Quote } from "@/lib/money/member-wallet-actions";
import type { MovementView } from "@/lib/money/member-wallet";
import { ACTION_LABEL, MOVE_COPY } from "@/lib/money/balance-copy";
import { SEND_REASONS, type SendReason } from "@/lib/money/wallet-view";
import { shareChips } from "../AmountPad";
import { Breakdown, Watching } from "./balance-ui";
import { reach } from "./reach";
import { WALLET_LINKS, WalletHeader, type WalletLinks } from "./WalletChrome";
import { AmountEntry, AvailableLine, Initial, Keypad, NotAvailable, PickArt, PickRow, QuickChips, type QuickAmount } from "./MoveKit";
import "@/app/css/money-wallet.css";

/**
 * SEND (Part B phase 10; D81, the Supay reference's payment screen): the
 * Available line, the amount, "Send to" with Change, what it is for, then
 * Continue; then the provider's quote with every fee, slide to send, the
 * code if the provider asks for one, and the waiting room until it settles.
 *
 * "Send" is the one word (the brief: never Send and Transfer for one
 * operation). The recipient is a Vallo member found by their phone and shown
 * as the server names them; the reason is the send's own note to them, at
 * most 100 characters, and changes nothing about the money. A double tap, a
 * retried post and a replay all land on one row (`clientKey`). Not
 * connected, the last step says plainly it is not available yet.
 */
type Step = "amount" | "review" | "otp" | "waiting" | "unavailable";

export function SendScreen({
  availableMinor,
  connected,
  locale,
  links = WALLET_LINKS,
  initial,
}: {
  availableMinor: number | null;
  connected: boolean;
  locale: Locale;
  links?: WalletLinks;
  /** The preview harness's way in to a later step, with sample data it labels. */
  initial?: { step?: Step; amount?: string; recipient?: { phone: string; name: string }; reason?: SendReason; quote?: Quote; movement?: MovementView };
}) {
  const router = useRouter();
  const [clientKey, setClientKey] = useState(() => crypto.randomUUID());
  const [step, setStep] = useState<Step>(initial?.step ?? "amount");
  const [amount, setAmount] = useState(initial?.amount ?? "");
  const [recipient, setRecipient] = useState<{ phone: string; name: string } | null>(initial?.recipient ?? null);
  const [reason, setReason] = useState<SendReason | null>(initial?.reason ?? null);
  const [other, setOther] = useState("");
  const [whoOpen, setWhoOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [found, setFound] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [quote, setQuote] = useState<Quote | null>(initial?.quote ?? null);
  const [movement, setMovement] = useState<MovementView | null>(initial?.movement ?? null);
  /* The code step's own instruction (where the code went). Every outcome is
     said by the one banner at the top of the screen (Grade 1). */
  const [busy, setBusy] = useState(false);

  const chips: QuickAmount[] = availableMinor !== null ? shareChips(availableMinor) : [];
  const note = reason === "Other" ? other.trim() : (reason ?? "");
  const ready = Boolean(amount) && (connected ? recipient !== null : true);

  const find = async () => {
    if (!connected) {
      banner.warning(MOVE_COPY.notAvailableSend);
      return;
    }
    setBusy(true);
    const r = await reach(() => findBalanceRecipient({ phone }));
    setBusy(false);
    if (r.ok) setFound(r.data.name);
    else banner.error(r.error);
  };

  const prepare = async () => {
    if (!connected || !recipient) {
      setStep("unavailable");
      return;
    }
    setBusy(true);
    const r = await reach(() => prepareSend({ clientKey, phone: recipient.phone, amount, ...(note ? { note: note.slice(0, 100) } : {}) }));
    setBusy(false);
    if (!r.ok) {
      banner.error(r.error);
      if (!r.unreached) setClientKey(crypto.randomUUID());
      return;
    }
    setQuote(r.data);
    setStep("review");
  };

  const submit = async (code?: string): Promise<boolean> => {
    if (!quote) return false;
    const r = await reach(() => confirmBalanceMovement({ movementId: quote.movementId, ...(code ? { otp: code } : {}) }));
    if (!r.ok) {
      banner.error(r.error);
      return false;
    }
    if (r.data.needsOtp) {
      setStep("otp");
      /* "We sent you a code": said by the one banner (founder, 7 November 2026). */
      if (r.data.message) banner.info(r.data.message);
      return false;
    }
    setMovement(r.data.movement);
    setStep("waiting");
    return true;
  };

  /* Leaving a staged send cancels it: staging moved nothing, and nothing will. */
  const backFromReview = () => {
    if (quote) void reach(() => cancelBalanceMovement({ movementId: quote.movementId }));
    setQuote(null);
    setClientKey(crypto.randomUUID());
    setStep("amount");
  };

  /* SW5 (round 3): the three questions of a send (how much and to whom, the
     quote, the code) stand in the platform's STEP FRAME. The keypad and the
     slide stay in the content, exactly the controls they were: the slide is
     the review's only confirm, so that step lights no button in the foot.
     The two outcomes (not available, the waiting room) keep the wallet's own
     top, because they are results, not steps. Every gate, key and reach is
     unchanged. */
  const framed = step === "amount" || step === "review" || step === "otp";
  const body = (
    <div className="nf-balance nf-mw" data-screen="send" data-testid="wallet-send" data-step={step}>
      {framed ? null : <WalletHeader title={ACTION_LABEL.send} back={links.overview} />}

      {step === "amount" ? (
        <div className="nf-mw-move">
          <AvailableLine minor={availableMinor} locale={locale} connected={connected} />
          <AmountEntry value={amount} onChange={setAmount} label="Amount to send" hint="The smallest amount is ₦100." />
          {chips.length > 0 ? <QuickChips chips={chips} value={amount} onChange={setAmount} /> : null}
          <PickRow
            label={MOVE_COPY.sendTo}
            value={recipient ? recipient.name : MOVE_COPY.chooseRecipient}
            lead={recipient ? <Initial name={recipient.name} /> : <PickArt name="people-group" />}
            action={recipient ? MOVE_COPY.change : "Choose"}
            onOpen={() => {
              setWhoOpen(true);
              setFound(null);
            }}
            testId="send-recipient"
          />
          <div className="grid gap-xs">
            <p className="nf-mw-label" id="nf-mw-reason">
              {MOVE_COPY.reason}
            </p>
            <div className="nf-mw-reasons" role="group" aria-labelledby="nf-mw-reason" data-testid="send-reasons">
              {SEND_REASONS.map((r) => (
                <button key={r} type="button" className="nf-mw-chip" data-tone="spark" aria-pressed={reason === r} onClick={() => setReason(reason === r ? null : r)}>
                  {r}
                </button>
              ))}
            </div>
            {reason === "Other" ? <TextField label={MOVE_COPY.otherReason} value={other} maxLength={100} showCount enterKeyHint="done" onChange={(e) => setOther(e.target.value)} /> : null}
          </div>
          <div className="nf-mw-foot">
            <Keypad value={amount} onChange={setAmount} />
          </div>
        </div>
      ) : null}

      {step === "review" && quote ? (
        <div className="nf-mw-move" data-testid="send-review">
          <Breakdown breakdown={quote.breakdown} locale={locale} destination={{ label: "To", title: quote.destination.title, detail: quote.destination.detail }} receivedLabel="They receive" />
          {note ? (
            <p className="nf-caption text-[var(--nf-content-secondary)]">
              For: <span className="font-semibold text-[var(--nf-content-primary)]">{note}</span>
            </p>
          ) : null}
          <p className="nf-caption text-[var(--nf-content-muted)]">A send cannot be taken back once it is confirmed. Reference {quote.reference}.</p>
          <div className="nf-mw-foot">
            <DragToConfirm
              money
              label="Slide to send"
              armedLabel="Press again to send"
              keyboardLabel="Send"
              confirmingLabel="Sending"
              confirmedLabel="Sent"
              errorLabel="Not sent. Nothing has moved."
              onConfirm={() => submit()}
            />
            <Button variant="secondary" size="lg" full onClick={backFromReview}>
              Change something
            </Button>
          </div>
        </div>
      ) : null}

      {step === "otp" ? (
        <div className="nf-mw-move">
          <TextField
            label="Code"
            inputMode="numeric"
            enterKeyHint="go"
            autoComplete="one-time-code"
            maxLength={8}
            inputClassName="nf-balance__otp"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
          />
        </div>
      ) : null}

      {step === "unavailable" ? <NotAvailable body={MOVE_COPY.notAvailableSend} back={links.overview} /> : null}

      {step === "waiting" && movement ? (
        <div className="grid gap-block pb-block">
          <Watching kind="send" movement={movement} locale={locale} onDone={() => router.push(links.overview)} onSettled={() => router.refresh()} />
        </div>
      ) : null}

      <Sheet open={whoOpen} onOpenChange={setWhoOpen} title={MOVE_COPY.sendTo} testId="send-who">
        <div className="grid gap-block pb-block">
          <p className="nf-body-sm text-[var(--nf-content-secondary)]">Send to another Vallo member by their phone number.</p>
          <TextField
            label="Their phone number"
            type="tel"
            inputMode="tel"
            enterKeyHint="done"
            autoComplete="off"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setFound(null);
            }}
          />
          {found ? (
            <div className="nf-balance__verified" data-testid="balance-recipient">
              <p className="nf-caption text-[var(--nf-content-secondary)]">This number belongs to</p>
              <p className="nf-h3 mt-xs text-[var(--nf-content-primary)]">{found}</p>
              <div className="mt-row grid grid-cols-2 gap-sm">
                <Button variant="secondary" onClick={() => setFound(null)}>
                  Not them
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    setRecipient({ phone, name: found });
                    setWhoOpen(false);
                  }}
                >
                  Yes, {found.split(" ")[0]}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="primary" size="lg" full loading={busy} disabled={phone.replace(/\D/g, "").length < 10} onClick={find}>
              Find member
            </Button>
          )}
        </div>
      </Sheet>
    </div>
  );

  if (!framed) return body;
  const at = step === "amount" ? 1 : step === "review" ? 2 : 3;
  return (
    <StepFrame
      testId="send-steps"
      step={at}
      total={3}
      eyebrow={ACTION_LABEL.send}
      title={step === "amount" ? SEND_STEP.amount : step === "review" ? MOVE_COPY.review : SEND_STEP.code}
      direction={at === 1 ? "back" : "forward"}
      {...(step === "review" ? { onBack: backFromReview } : {})}
      closeHref={links.overview}
      {...(step === "amount"
        ? { primary: { label: MOVE_COPY.continue, onClick: prepare, loading: busy, disabled: !ready, testId: "move-continue" } }
        : step === "otp"
          ? {
              primary: {
                label: "Confirm send",
                loading: busy,
                disabled: otp.length < 4,
                onClick: async () => {
                  setBusy(true);
                  await submit(otp);
                  setBusy(false);
                },
              },
            }
          : {})}
    >
      {body}
    </StepFrame>
  );
}

/* The step titles a send did not have words for (English, like the rest of
   this screen's copy). */
const SEND_STEP = { amount: "How much, and to whom", code: "Enter the code" } as const;
