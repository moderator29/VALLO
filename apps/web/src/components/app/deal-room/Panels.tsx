import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { Panel } from "@/components/ui/Panel";
import { State } from "@/components/ui/State";
import { StatusChip } from "@/components/ui/StatusChip";
import { ButtonLink } from "@/components/ui/Button";
import { formatDay, formatWhen, proposedDate } from "@/lib/offers/format";
import {
  AGREED_IS_NOT_SALE,
  NO_MONEY_TAKEN,
  PAYMENT_CAVEAT,
  PAYMENT_LABEL,
  TITLE_NOT_VERIFIED,
  eventWord,
  mandateLine,
  sideWord,
} from "@/lib/offers/words";
import type { DealRoom } from "@/lib/offers/types";
import { Facts, OfferFigures } from "@/components/app/offers/OfferParts";
import { fourAnswers, latestVersion } from "./model";

/** The panels of the room that only present: no state, no actions. */

export function FourQuestions({ room, nowMs }: { room: DealRoom; nowMs: number }) {
  const a = fourAnswers(room, nowMs);
  return (
    <dl className="nf-room__four" data-testid="four-questions">
      <div>
        <dt>What has happened</dt>
        <dd>{a.happened}</dd>
      </div>
      <div>
        <dt>What is waiting</dt>
        <dd>{a.waiting}</dd>
      </div>
      <div>
        <dt>Whose turn it is</dt>
        <dd>{a.turn}</dd>
      </div>
      <div>
        <dt>Deadline</dt>
        <dd>{a.deadline}</dd>
      </div>
    </dl>
  );
}

export function OverviewPanel({ room, nowMs, action }: { room: DealRoom; nowMs: number; action: React.ReactNode }) {
  const v = latestVersion(room);
  const { offer } = room;
  const mandate = mandateLine(room.mandate.held, room.mandate.reviewedOn, room.mandate.expiresOn, formatDay);
  return (
    <div className="grid gap-md" data-testid="panel-overview">
      <Panel variant="card" className="p-card">
        <OfferFigures
          amountMinor={v?.amountMinor ?? offer.amountMinor}
          askingMinor={offer.askingMinor}
          label={v ? `Current terms, version ${v.version}` : "Current terms"}
          atAskingPrice={v?.terms.atAskingPrice ?? false}
        />
        <div className="mt-md">
          <Facts
            items={[
              { label: "Payment", value: PAYMENT_LABEL[v?.terms.paymentPreference ?? offer.paymentPreference] },
              { label: "Closing", value: proposedDate(v?.terms.targetClosing ?? offer.targetClosing) },
              { label: "Sent", value: formatWhen(offer.submittedAt) },
            ]}
          />
        </div>
      </Panel>
      <Panel variant="card" className="p-card">
        <FourQuestions room={room} nowMs={nowMs} />
      </Panel>
      {action}
      <div className="grid gap-xs nf-body-sm text-[var(--nf-content-muted)]">
        {offer.state === "agreed" ? <p className="font-semibold text-[var(--nf-content-primary)]">{AGREED_IS_NOT_SALE}</p> : null}
        {v ? <p>{PAYMENT_CAVEAT[v.terms.paymentPreference]}</p> : null}
        <p>{TITLE_NOT_VERIFIED}</p>
        <p>{NO_MONEY_TAKEN}</p>
        {mandate ? <p>{mandate}</p> : null}
        <p>{room.viewerSide === "seller" ? (room.buyerEligible ? "The buyer meets the requirements for this offer." : "The buyer does not yet meet the requirements for this offer.") : null}</p>
      </div>
    </div>
  );
}

export function NegotiationPanel({ room, newVersion }: { room: DealRoom; newVersion?: number }) {
  const last = room.versions.length ? room.versions[room.versions.length - 1]!.version : 0;
  return (
    <div className="grid gap-lg" data-testid="panel-negotiation">
      <p className="nf-body text-[var(--nf-content-secondary)]">Every proposal is kept as its own version. Nothing is overwritten. Agreement needs both sides to confirm the same version.</p>
      {room.versions.map((v) => (
        <article key={v.version} className="nf-ver" data-current={v.version === last ? "" : undefined} data-new={v.version === newVersion ? "" : undefined} data-testid="version">
          <header className="flex flex-wrap items-center justify-between gap-sm">
            <h3 className="nf-h4">
              Version {v.version}
              <span className="text-[var(--nf-content-muted)]"> · {sideWord(v.proposedBy, room.viewerSide) === "You" ? "proposed by you" : `proposed by ${v.proposedBy}`}</span>
            </h3>
            <time dateTime={v.at} className="nf-caption text-[var(--nf-content-muted)]">
              {formatWhen(v.at)}
            </time>
          </header>
          <OfferFigures amountMinor={v.amountMinor} askingMinor={room.offer.askingMinor} label="Figure" atAskingPrice={v.terms.atAskingPrice} />
          {v.changes.length ? (
            <ul className="nf-ver__changes" aria-label="What changed">
              {v.changes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          ) : (
            <p className="nf-body-sm text-[var(--nf-content-muted)]">The first offer.</p>
          )}
          <Facts items={[{ label: "Payment", value: PAYMENT_LABEL[v.terms.paymentPreference] }, { label: "Closing", value: proposedDate(v.terms.targetClosing) }, ...(v.terms.note ? [{ label: "Note", value: v.terms.note }] : [])]} />
          <div className="flex flex-wrap gap-xs">
            <StatusChip state={v.buyerConfirmed ? "success" : "neutral"} size="xs">
              {v.buyerConfirmed ? "Buyer confirmed" : "Buyer not confirmed"}
            </StatusChip>
            <StatusChip state={v.sellerConfirmed ? "success" : "neutral"} size="xs">
              {v.sellerConfirmed ? "Seller confirmed" : "Seller not confirmed"}
            </StatusChip>
          </div>
        </article>
      ))}
    </div>
  );
}

export function MessagesPanel({ room }: { room: DealRoom }) {
  if (!room.conversationId) {
    return (
      <State
        kind="empty"
        compact
        icon="chat-duo"
        title="No conversation yet"
        body="When either side sends a message about this offer it will appear here and in your Messages."
        data-testid="panel-messages"
      />
    );
  }
  return (
    <div className="grid gap-md" data-testid="panel-messages">
      <Panel variant="card" className="p-card grid gap-sm">
        <h3 className="nf-h4">The conversation for this offer</h3>
        <p className="nf-body text-[var(--nf-content-secondary)]">
          Messages about this offer live in your Messages, in the same thread as the offer card, so there is one place to talk and nothing is split across two inboxes.
        </p>
        <ButtonLink href={`/messages/${room.conversationId}`} variant="primary" size="lg" full leadingIcon="chat-bubble" data-testid="open-conversation">
          Open the conversation
        </ButtonLink>
      </Panel>
      <p className="nf-body-sm text-[var(--nf-content-muted)]">Keep the talk and the money on Vallo. Be careful if anyone asks you to pay outside the platform. Vallo never asks for a deposit to secure a property.</p>
    </div>
  );
}

export function InspectionPanel({ room }: { room: DealRoom }) {
  const { offer } = room;
  const report = room.documents.find((d) => d.category === "inspection_report");
  const base = `/listing/${offer.listingId}/visit`;
  return (
    <div className="grid gap-md" data-testid="panel-inspection">
      <Panel variant="card" className="p-card grid gap-sm">
        <h3 className="nf-h4">Inspect before you go further</h3>
        <p className="nf-body text-[var(--nf-content-secondary)]">
          {offer.state === "agreed"
            ? "The terms are agreed. Before anything else, inspect the property. Propose a time, confirm or reschedule it, and the visit is recorded here."
            : "You can propose an inspection at any point. It does not commit either side to the offer."}
        </p>
        {room.inspectionId ? (
          <ButtonLink href={`${base}/${room.inspectionId}`} variant="primary" size="lg" full leadingIcon="calendar-check" data-testid="open-inspection">
            Open the inspection
          </ButtonLink>
        ) : (
          <ButtonLink href={base} variant="primary" size="lg" full leadingIcon="calendar-booking" data-testid="schedule-inspection">
            Schedule an inspection
          </ButtonLink>
        )}
      </Panel>
      <Panel variant="card" className="p-card grid gap-xs">
        <h3 className="nf-h4">Inspection report</h3>
        {report ? (
          <>
            <p className="nf-body text-[var(--nf-content-secondary)]">An inspection report is attached to this deal. It records eight items with photographs, dated. It is a record of what was seen, not a check of title.</p>
            <p className="nf-body-sm text-[var(--nf-content-muted)]">Uploaded {report.uploadedAt ? formatWhen(report.uploadedAt) : ""}.</p>
          </>
        ) : (
          <p className="nf-body text-[var(--nf-content-secondary)]">No report yet. Once the inspection is completed, the eight-item report with photographs appears here.</p>
        )}
      </Panel>
    </div>
  );
}

export function ActivityPanel({ room }: { room: DealRoom }) {
  if (!room.events.length) {
    return <State kind="empty" compact title="No activity yet" body="Every action on this offer is recorded here with who did it and when." data-testid="panel-activity" />;
  }
  return (
    <div data-testid="panel-activity">
      <ListGroup>
        {[...room.events].reverse().map((e) => (
          <ListRow
            key={e.id}
            title={eventWord(e.action)}
            sub={`${e.actor === room.viewerSide ? "You" : (e.actorName ?? (e.actor === "vallo" ? "Vallo staff" : "System"))} · version ${e.version}${e.note ? ` · ${e.note}` : ""}`}
            value={<span className="nf-caption">{formatWhen(e.at)}</span>}
          />
        ))}
      </ListGroup>
    </div>
  );
}
