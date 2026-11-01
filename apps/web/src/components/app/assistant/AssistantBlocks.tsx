"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useState } from "react";
import {
  assistantDecide,
  assistantListingPhotos,
  assistantMoveSlots,
  assistantPaymentStatus,
  assistantProposeCancelViewing,
  assistantProposeMove,
  assistantProposeViewing,
  assistantRetry,
  assistantSave,
  assistantViewingSlots,
} from "@/lib/assistant/action-actions";
import type { AssistantAction, AssistantCard, AssistantSlot, AssistantStreamEvent } from "@/lib/assistant/types";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { AI_GLYPH, summaryGlyph } from "@/lib/assistant/glyphs";
import "./assistant-blocks.css";

/**
 * THE INTERACTIVE PARTS OF AN ANSWER: cards with buttons, viewing times,
 * money summaries, a payment to approve, a strip of pictures.
 *
 * Every block arrives from the SERVER (built from a tool's own result), so a
 * button, a time or an amount is never something the model wrote. Every button
 * that does anything calls a server action that re-verifies the person and the
 * permission; this file only draws the state and says what the server said.
 *
 * Nothing here is kept on the device: blocks hold figures and offers that were
 * true at one moment, so they are not written to local storage.
 */

export type AssistantBlock = Extract<
  AssistantStreamEvent,
  { type: "cards" | "actions" | "slots" | "summary" | "payment_review" | "photos" }
>;

type Status = { tone: "ok" | "error" | "busy"; text: string } | null;

const GLYPH = { slots: AI_GLYPH.schedule, pay: AI_GLYPH.payment, photos: AI_GLYPH.photos } as const;

function StatusLine({ status }: { status: Status }) {
  if (!status) return null;
  return (
    <p className={`nf-aib__status nf-aib__status--${status.tone}`} role={status.tone === "error" ? "alert" : "status"}>
      {status.text}
    </p>
  );
}

/* ------------------------------------------------------------------ buttons */

type Runner = {
  busy: string | null;
  run: (action: AssistantAction) => void;
};

function Buttons({ actions, runner, saved }: { actions: AssistantAction[]; runner: Runner; saved: Record<string, boolean> }) {
  return (
    <div className="nf-aib__actions">
      {actions.map((a) => {
        if (a.kind === "link") {
          return (
            <Link key={a.id} href={a.href} className="nf-aib__btn nf-aib__btn--link">
              {a.label}
            </Link>
          );
        }
        if (a.kind === "download") {
          /* Only our own statement route: a download href from anywhere else is not drawn. */
          if (a.href !== "/api/statement") return null;
          return (
            <a key={a.id} href={a.href} download className="nf-aib__btn nf-aib__btn--link">
              {a.label}
            </a>
          );
        }
        const isSave = a.kind === "save" || a.kind === "unsave";
        const listingSaved = isSave ? saved[a.listingId] : undefined;
        const label = isSave ? (listingSaved === undefined ? a.label : listingSaved ? "Saved" : "Save") : a.label;
        const primary = a.kind === "confirm";
        return (
          <button
            key={a.id}
            type="button"
            className={`nf-aib__btn${primary ? " nf-aib__btn--primary" : ""}${isSave && (listingSaved ?? a.kind === "unsave") ? " nf-aib__btn--on" : ""}`}
            disabled={runner.busy !== null}
            aria-busy={runner.busy === a.id}
            onClick={() => runner.run(a)}
          >
            {runner.busy === a.id ? "Working..." : label}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------- cards */

function PickCard({ card, runner, saved }: { card: AssistantCard; runner: Runner; saved: Record<string, boolean> }) {
  const [why, setWhy] = useState(false);
  return (
    <article className="nf-ai__result nf-aib__card">
      <div className="nf-ai__result-media">
        {card.photo ? <Image src={card.photo} alt="" fill sizes="(max-width: 640px) 80vw, 280px" /> : null}
        {card.verified ? (
          <span className="nf-ai__result-mark">
            <UiIcon name="verified" size={12} />
            Verified
          </span>
        ) : null}
      </div>
      <div className="nf-aib__card-body">
        <span className="nf-ai__result-title" title={card.title}>
          {card.title}
        </span>
        <span className="nf-ai__result-where">
          <UiIcon name="location" size={12} className="shrink-0" />
          <span className="truncate">{card.city}</span>
        </span>
        <span className="nf-ai__result-price nf-numeric">{card.price}</span>
        <span className="nf-aib__facts nf-numeric">
          {[card.bedrooms ? `${card.bedrooms} bed` : null, card.bathrooms ? `${card.bathrooms} bath` : null, card.sizeSqm ? `${card.sizeSqm} sqm` : null]
            .filter(Boolean)
            .join(" · ")}
        </span>
        {card.reason ? (
          <button type="button" className="nf-aib__why" aria-expanded={why} onClick={() => setWhy((v) => !v)}>
            Why this?
          </button>
        ) : null}
        {card.reason && why ? <p className="nf-aib__reason">{card.reason}</p> : null}
        <Buttons actions={card.actions} runner={runner} saved={saved} />
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------- slots */

function SlotsBlock({
  listingId,
  title,
  slots,
  moveFrom,
  runner,
  onProposed,
}: {
  listingId: string;
  title: string;
  slots: AssistantSlot[];
  /** Set when these are times to MOVE one of the member's own viewings to. */
  moveFrom?: string | undefined;
  runner: Runner;
  onProposed: (block: AssistantBlock[]) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const choose = async (slot: AssistantSlot) => {
    setPicked(slot.slotAt);
    setStatus({ tone: "busy", text: "Checking that time is still open..." });
    if (moveFrom) {
      const moved = await assistantProposeMove({ inspectionId: moveFrom, slotAt: slot.slotAt });
      if (!moved.ok) {
        setStatus({ tone: "error", text: moved.error });
        setPicked(null);
        return;
      }
      setStatus(null);
      onProposed([
        {
          type: "summary",
          title: "Move this viewing?",
          rows: [
            { label: "Place", value: moved.data.title },
            { label: "From", value: moved.data.fromLabel },
            { label: "To", value: moved.data.toLabel },
          ],
          note: "The lister is told. Your current time stands until you confirm.",
        },
        {
          type: "actions",
          items: [
            { id: `confirm-${moved.data.proposalId}`, label: "Confirm new time", kind: "confirm", proposalId: moved.data.proposalId, payloadHash: moved.data.payloadHash },
            { id: `cancel-${moved.data.proposalId}`, label: "Keep my time", kind: "cancel", proposalId: moved.data.proposalId, payloadHash: moved.data.payloadHash },
          ],
        },
      ]);
      return;
    }
    const res = await assistantProposeViewing({ listingId, slotAt: slot.slotAt });
    if (!res.ok) {
      setStatus({ tone: "error", text: res.error });
      setPicked(null);
      return;
    }
    setStatus(null);
    onProposed([
      { type: "summary", title: "Review your viewing", rows: [{ label: "Place", value: res.data.title }, { label: "When", value: res.data.whenLabel }], note: "Nothing is booked until you confirm." },
      {
        type: "actions",
        items: [
          { id: `confirm-${res.data.proposalId}`, label: "Confirm viewing", kind: "confirm", proposalId: res.data.proposalId, payloadHash: res.data.payloadHash },
          { id: `cancel-${res.data.proposalId}`, label: "Cancel", kind: "cancel", proposalId: res.data.proposalId, payloadHash: res.data.payloadHash },
        ],
      },
    ]);
  };
  void runner;
  return (
    <section className="nf-aib__panel" aria-label={`Viewing times for ${title}`}>
      <header className="nf-aib__head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={GLYPH.slots} alt="" width={28} height={28} className="nf-aib__glyph" />
        <div>
          <h3 className="nf-aib__title">{moveFrom ? "Pick a new time" : "Pick a viewing time"}</h3>
          <p className="nf-aib__sub">{title}</p>
        </div>
      </header>
      <div className="nf-aib__chips" role="group" aria-label="Open times">
        {slots.map((s) => (
          <button
            key={s.slotAt}
            type="button"
            className={`nf-aib__chip${picked === s.slotAt ? " nf-aib__chip--on" : ""}`}
            aria-pressed={picked === s.slotAt}
            disabled={picked !== null}
            onClick={() => void choose(s)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <StatusLine status={status} />
    </section>
  );
}

/* ----------------------------------------------------------------- summary */

function SummaryBlock({ title, rows, note }: { title: string; rows: { label: string; value: string; date?: string; status?: string }[]; note?: string }) {
  const glyph = summaryGlyph(title);
  return (
    <section className="nf-aib__panel" aria-label={title}>
      <header className="nf-aib__head">
        {glyph ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={glyph} alt="" width={28} height={28} className="nf-aib__glyph" /> : null}
        <h3 className="nf-aib__title">{title}</h3>
      </header>
      <dl className="nf-aib__rows">
        {rows.map((r, i) => (
          <div key={`${r.label}-${i}`} className="nf-aib__row">
            <dt>
              {r.label}
              {r.date ? <span className="nf-aib__date">{r.date}</span> : null}
            </dt>
            <dd className="nf-numeric">
              {r.value}
              {r.status ? <span className="nf-aib__state">{r.status}</span> : null}
            </dd>
          </div>
        ))}
      </dl>
      {note ? <p className="nf-aib__note">{note}</p> : null}
    </section>
  );
}

/* ----------------------------------------------------------------- payment */

type Review = Extract<AssistantBlock, { type: "payment_review" }>;

function PaymentReview({ review }: { review: Review }) {
  const [proposal, setProposal] = useState({ id: review.proposalId, hash: review.payloadHash });
  const [phase, setPhase] = useState<"review" | "working" | "ready" | "cancelled" | "failed" | "paid">("review");
  const [url, setUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(null);

  const confirm = async () => {
    setPhase("working");
    setStatus({ tone: "busy", text: "Verifying and opening the secure payment page..." });
    const res = await assistantDecide({ proposalId: proposal.id, payloadHash: proposal.hash, decision: "confirm" });
    if (!res.ok) {
      setPhase("failed");
      setStatus({ tone: "error", text: res.error });
      return;
    }
    if (res.data.kind === "open_checkout") {
      setUrl(res.data.url);
      setPhase("ready");
      setStatus({ tone: "ok", text: res.data.message });
    }
  };
  const cancel = async () => {
    await assistantDecide({ proposalId: proposal.id, payloadHash: proposal.hash, decision: "cancel" });
    setPhase("cancelled");
    setStatus({ tone: "ok", text: "Cancelled. Nothing was charged." });
  };
  const retry = async () => {
    setStatus({ tone: "busy", text: "Setting it up again..." });
    const res = await assistantRetry({ proposalId: proposal.id });
    if (!res.ok) {
      setStatus({ tone: "error", text: res.error });
      return;
    }
    setProposal({ id: res.data.proposalId, hash: res.data.payloadHash });
    setPhase("review");
    setStatus(null);
  };
  const check = async () => {
    setStatus({ tone: "busy", text: "Checking with the provider..." });
    const res = await assistantPaymentStatus({ proposalId: proposal.id });
    if (!res.ok) {
      setStatus({ tone: "error", text: res.error });
      return;
    }
    if (res.data.paid) setPhase("paid");
    setStatus({ tone: res.data.paid ? "ok" : "busy", text: res.data.message });
  };

  return (
    <section className="nf-aib__panel nf-aib__panel--pay" aria-label="Payment to review">
      <header className="nf-aib__head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={GLYPH.pay} alt="" width={28} height={28} className="nf-aib__glyph" />
        <div>
          <h3 className="nf-aib__title">Review this payment</h3>
          <p className="nf-aib__sub">{review.service}</p>
        </div>
      </header>
      <dl className="nf-aib__rows">
        {review.fees.map((f) => (
          <div key={f.label} className="nf-aib__row">
            <dt>{f.label}</dt>
            <dd className="nf-numeric">{f.value}</dd>
          </div>
        ))}
        <div className="nf-aib__row nf-aib__row--total">
          <dt>Total to pay</dt>
          <dd className="nf-numeric">{review.total}</dd>
        </div>
      </dl>
      <p className="nf-aib__note">{review.recipient}</p>
      <p className="nf-aib__note">Nothing is charged until you confirm here and verify on the payment page. This offer lasts ten minutes.</p>
      {phase === "review" || phase === "working" ? (
        <div className="nf-aib__actions">
          <button type="button" className="nf-aib__btn nf-aib__btn--primary" disabled={phase === "working"} onClick={() => void confirm()}>
            {phase === "working" ? "Working..." : "Confirm and pay"}
          </button>
          <button type="button" className="nf-aib__btn" disabled={phase === "working"} onClick={() => void cancel()}>
            Cancel
          </button>
        </div>
      ) : null}
      {phase === "ready" && url ? (
        <div className="nf-aib__actions">
          <a className="nf-aib__btn nf-aib__btn--primary" href={url} target="_blank" rel="noopener noreferrer">
            Open payment page
          </a>
          <button type="button" className="nf-aib__btn" onClick={() => void check()}>
            I have paid: check status
          </button>
        </div>
      ) : null}
      {phase === "failed" ? (
        <div className="nf-aib__actions">
          <button type="button" className="nf-aib__btn" onClick={() => void retry()}>
            Try again
          </button>
        </div>
      ) : null}
      <StatusLine status={status} />
    </section>
  );
}

/* ------------------------------------------------------------------ photos */

function PhotosBlock({ title, urls }: { title: string; urls: string[] }) {
  return (
    <section className="nf-aib__panel" aria-label={`Pictures of ${title}`}>
      <header className="nf-aib__head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={GLYPH.photos} alt="" width={28} height={28} className="nf-aib__glyph" />
        <h3 className="nf-aib__title">{title}</h3>
      </header>
      <ul className="nf-aib__strip">
        {urls.map((u, i) => (
          <li key={u} className="nf-aib__shot">
            <Image src={u} alt={`${title}, picture ${i + 1} of ${urls.length}`} fill sizes="(max-width: 640px) 80vw, 320px" />
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------- the lot */

export function AssistantBlocks({ blocks, onAsk }: { blocks: AssistantBlock[]; onAsk: (prompt: string) => void }) {
  const [extra, setExtra] = useState<AssistantBlock[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  const run = useCallback(
    async (action: AssistantAction) => {
      if (action.kind === "link" || action.kind === "download") return;
      if (action.kind === "ask") {
        onAsk(action.prompt);
        return;
      }
      setBusy(action.id);
      setStatus(null);
      try {
        if (action.kind === "photos") {
          const res = await assistantListingPhotos({ listingId: action.listingId });
          if (!res.ok) setStatus({ tone: "error", text: res.error });
          else setExtra((e) => [...e, { type: "photos", listingId: action.listingId, title: res.data.title, urls: res.data.urls }]);
        } else if (action.kind === "slots") {
          const res = await assistantViewingSlots({ listingId: action.listingId });
          if (!res.ok) setStatus({ tone: "error", text: res.error });
          else setExtra((e) => [...e, { type: "slots", listingId: res.data.listingId, title: res.data.title, slots: res.data.slots }]);
        } else if (action.kind === "viewing_cancel") {
          const res = await assistantProposeCancelViewing({ inspectionId: action.inspectionId });
          if (!res.ok) setStatus({ tone: "error", text: res.error });
          else
            setExtra((e) => [
              ...e,
              {
                type: "summary",
                title: "Cancel this viewing?",
                rows: [
                  { label: "Place", value: res.data.title },
                  { label: "When", value: res.data.whenLabel },
                ],
                note: "The lister is told. Nothing changes until you confirm.",
              },
              {
                type: "actions",
                items: [
                  { id: `confirm-${res.data.proposalId}`, label: "Confirm cancellation", kind: "confirm", proposalId: res.data.proposalId, payloadHash: res.data.payloadHash },
                  { id: `cancel-${res.data.proposalId}`, label: "Keep my viewing", kind: "cancel", proposalId: res.data.proposalId, payloadHash: res.data.payloadHash },
                ],
              },
            ]);
        } else if (action.kind === "viewing_move") {
          const res = await assistantMoveSlots({ inspectionId: action.inspectionId });
          if (!res.ok) setStatus({ tone: "error", text: res.error });
          else setExtra((e) => [...e, { type: "slots", listingId: res.data.listingId, title: res.data.title, slots: res.data.slots, moveFrom: res.data.inspectionId }]);
        } else if (action.kind === "save" || action.kind === "unsave") {
          const want = action.kind === "save" ? !(saved[action.listingId] ?? false) : false;
          const res = await assistantSave({ listingId: action.listingId, want: action.kind === "save" ? want : false });
          if (!res.ok) setStatus({ tone: "error", text: res.error });
          else {
            setSaved((s) => ({ ...s, [action.listingId]: res.data.saved }));
            setStatus({ tone: "ok", text: res.data.saved ? "Saved to your list." : "Removed from your saved list." });
          }
        } else if (action.kind === "confirm" || action.kind === "cancel") {
          const res = await assistantDecide({ proposalId: action.proposalId, payloadHash: action.payloadHash, decision: action.kind });
          if (!res.ok) setStatus({ tone: "error", text: res.error });
          else if (res.data.kind === "cancelled") setStatus({ tone: "ok", text: "Cancelled. Nothing was done." });
          else if (res.data.kind === "viewing_booked" || res.data.kind === "viewing_changed") setStatus({ tone: "ok", text: res.data.message });
        } else if (action.kind === "retry") {
          const res = await assistantRetry({ proposalId: action.proposalId });
          setStatus(res.ok ? { tone: "ok", text: "Set up again. Review it above." } : { tone: "error", text: res.error });
        }
      } finally {
        setBusy(null);
      }
    },
    [onAsk, saved],
  );
  const runner: Runner = { busy, run: (a) => void run(a) };

  const all = [...blocks, ...extra];
  return (
    <div className="nf-aib" data-testid="assistant-blocks">
      {all.map((b, i) => {
        const key = `${b.type}-${i}`;
        switch (b.type) {
          case "cards":
            return (
              <section key={key} className="nf-aib__cards" aria-label={b.title ?? "Places"}>
                {b.title ? <h3 className="nf-aib__title">{b.title}</h3> : null}
                <ul className="nf-aib__rail">
                  {b.items.map((c) => (
                    <li key={c.id} className="nf-aib__rail-item">
                      <PickCard card={c} runner={runner} saved={saved} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          case "actions":
            return <Buttons key={key} actions={b.items} runner={runner} saved={saved} />;
          case "slots":
            return (
              <SlotsBlock
                key={key}
                listingId={b.listingId}
                title={b.title}
                slots={b.slots}
                moveFrom={b.moveFrom}
                runner={runner}
                onProposed={(more) => setExtra((e) => [...e, ...more])}
              />
            );
          case "summary":
            return <SummaryBlock key={key} title={b.title} rows={b.rows} {...(b.note ? { note: b.note } : {})} />;
          case "payment_review":
            return <PaymentReview key={key} review={b} />;
          case "photos":
            return <PhotosBlock key={key} title={b.title} urls={b.urls} />;
          default:
            return null;
        }
      })}
      <StatusLine status={status} />
    </div>
  );
}

export function isBlockEvent(event: AssistantStreamEvent): event is AssistantBlock {
  return (
    event.type === "cards" ||
    event.type === "actions" ||
    event.type === "slots" ||
    event.type === "summary" ||
    event.type === "payment_review" ||
    event.type === "photos"
  );
}
