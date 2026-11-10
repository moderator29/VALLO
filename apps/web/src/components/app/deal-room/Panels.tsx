import { plural } from "@vallo/i18n/core";
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
import type { DealThreadMessage } from "@/lib/offers/thread";
import { DealMessages } from "./DealMessages";
import { Facts, OfferFigures, SectionHead } from "@/components/app/offers/OfferParts";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { latestVersion } from "./model";

/** The panels of the room that only present: no state, no actions. */

export function OverviewPanel({ room, action }: { room: DealRoom; nowMs: number; action: React.ReactNode }) {
  const v = latestVersion(room);
  const { offer } = room;
  const mandate = mandateLine(room.mandate.held, room.mandate.reviewedOn, room.mandate.expiresOn, formatDay);
  return (
    <div className="grid gap-md" data-testid="panel-overview">
      <Panel variant="card" className="p-card">
        <SectionHead icon="receipt" title="Current terms" hint={v ? `Version ${v.version}` : undefined} />
        <OfferFigures
          amountMinor={v?.amountMinor ?? offer.amountMinor}
          askingMinor={offer.askingMinor}
          label="Offer"
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
      {action}
      <div className="grid gap-xs nf-body-sm text-[var(--nf-content-muted)]">
        {offer.state === "agreed" ? <p className="font-semibold text-[var(--nf-content-primary)]">{AGREED_IS_NOT_SALE}</p> : null}
        {v ? <p>{PAYMENT_CAVEAT[v.terms.paymentPreference]}</p> : null}
        <p>{TITLE_NOT_VERIFIED}</p>
        <p>{NO_MONEY_TAKEN}</p>
        {mandate ? (
          <p className="nf-ofr-mandate" data-testid="mandate-plate">
            <UiIcon name="shield-check" size={18} />
            <span>{mandate}</span>
          </p>
        ) : null}
        {room.viewerSide === "seller" ? <p>{room.buyerEligible ? "The buyer meets the requirements for this offer." : "The buyer does not yet meet the requirements for this offer."}</p> : null}
      </div>
    </div>
  );
}

/** A change string as a small chip with an arrow. Amount changes read their direction from the two figures. */
function diffChip(text: string, dir: "up" | "down" | "flat") {
  return (
    <li key={text} className="nf-tl__diff" data-dir={dir}>
      {dir === "flat" ? <UiIcon name="repost" size={12} /> : <UiIcon name={dir === "up" ? "arrow-up" : "arrow-down"} size={12} />}
      <span>{text}</span>
    </li>
  );
}

export function NegotiationPanel({ room, newVersion }: { room: DealRoom; newVersion?: number }) {
  const last = room.versions.length ? room.versions[room.versions.length - 1]!.version : 0;
  return (
    <div className="grid gap-md" data-testid="panel-negotiation">
      <p className="nf-body text-[var(--nf-content-secondary)]">Every proposal is kept as its own version. Nothing is overwritten. Agreement needs both sides to confirm the same version.</p>
      <ol className="nf-tl">
        {room.versions.map((v, i) => {
          const before = i > 0 ? room.versions[i - 1]! : null;
          const amountDir = before ? (v.amountMinor > before.amountMinor ? "up" : v.amountMinor < before.amountMinor ? "down" : "flat") : "flat";
          return (
            <li key={v.version} className="nf-tl__item" data-current={v.version === last ? "" : undefined} data-new={v.version === newVersion ? "" : undefined} data-testid="version">
              <span className="nf-tl__node" aria-hidden="true">
                {v.version}
              </span>
              <Panel variant="card" className="grid gap-sm p-card">
                <header className="flex flex-wrap items-center justify-between gap-sm">
                  <h3 className="nf-h4">Version {v.version}</h3>
                  <time dateTime={v.at} className="nf-caption text-[var(--nf-content-muted)]">
                    {formatWhen(v.at)}
                  </time>
                </header>
                <p className="nf-tl__who">{sideWord(v.proposedBy, room.viewerSide) === "You" ? "Proposed by you" : `Proposed by the ${v.proposedBy}`}</p>
                <OfferFigures amountMinor={v.amountMinor} askingMinor={room.offer.askingMinor} label="Figure" atAskingPrice={v.terms.atAskingPrice} bar={false} />
                {v.changes.length ? (
                  <ul className="nf-tl__diffs" aria-label="What changed">
                    {v.changes.map((c) => diffChip(c, c.startsWith("Amount") ? amountDir : "flat"))}
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
              </Panel>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function MessagesPanel({ room, thread }: { room: DealRoom; thread: DealThreadMessage[] }) {
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
  return <DealMessages conversationId={room.conversationId} messages={thread} counterpartyName={room.offer.counterpartyName} live={room.offer.state === "open" || room.offer.state === "agreed"} />;
}

export function InspectionPanel({ room }: { room: DealRoom }) {
  const { offer } = room;
  const report = room.documents.find((d) => d.category === "inspection_report");
  const base = `/listing/${offer.listingId}/visit`;
  return (
    <div className="grid gap-md" data-testid="panel-inspection">
      <Panel variant="card" className="p-card grid gap-sm">
        <SectionHead icon="calendar-check" title="Inspect before you go further" />
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
        <SectionHead icon="clipboard-list" title="Inspection report" hint="Eight items, dated, with photographs" />
        {room.inspectionReport ? (
          <>
            <p className="nf-body text-[var(--nf-content-secondary)]">The eight-item report from the joined inspection, dated {formatWhen(room.inspectionReport.submittedAt)}, with {plural(room.inspectionReport.photoCount, { one: "{count} photograph", other: "{count} photographs" })}. It records what was seen. It is not a check of title.</p>
            <ul className="nf-insp" data-testid="inspection-items">
              {room.inspectionReport.items.map((i) => (
                <li key={i.item} className="nf-insp__item">
                  <span className="nf-ofr-req__mark" data-state={i.checked ? "met" : "required"} aria-hidden="true">
                    {i.checked ? <UiIcon name="check" size={14} /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-[var(--nf-content-primary)]">{i.item.charAt(0).toUpperCase() + i.item.slice(1)}</span>
                    <span className="nf-insp__sub">{i.checked ? "Checked" : "Not checked"}{i.note ? ` · ${i.note}` : ""}</span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : report ? (
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
