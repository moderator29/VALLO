"use client";

import { useCallback, useState } from "react";
import { ActionBar } from "@/components/ui/ActionBar";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { StatusTrack, type TrackStep } from "@/components/app/status/StatusTrack";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { Disclosure } from "@/components/app/Disclosure";
import { OfferStateChip } from "@/components/app/offers/OfferParts";
import type { DealRoom } from "@/lib/offers/types";
import { DealSheets, type SheetKind } from "./DealSheets";
import { DocumentsPanel } from "./DocumentsPanel";
import type { DealThreadMessage } from "@/lib/offers/thread";
import { ActivityPanel, InspectionPanel, MessagesPanel, NegotiationPanel, OverviewPanel } from "./Panels";
import { RECORD_STAGE_BUTTON, ROOM_TABS, ROOM_TAB_LABEL, hasOpenQuestion, nextRecordableStage, trackFor, type RoomTab } from "./model";
import "@/components/ui/underline-tabs.css";
import "@/components/app/offers/offers.css";

type StageTarget = "due_diligence" | "documentation" | "closing" | "completed";

/**
 * THE DEAL ROOM. A surface over one offer, not a table of its own: the header,
 * a tracker that advances on recorded events only, and six sections. Tabs on a
 * phone; on a desktop the overview rides beside the section you are reading.
 *
 * The one next action is always one obvious button (pinned to the foot on a
 * phone, in the side column on a desktop). When nothing is waiting on the
 * viewer, the room says whose turn it is and offers the conversation instead.
 */
export function DealRoomView({ room, nowMs, initialTab = "overview", thread = [] }: { room: DealRoom; nowMs: number; initialTab?: RoomTab; thread?: DealThreadMessage[] }) {
  const [tab, setTab] = useState<RoomTab>(initialTab);
  const [sheet, setSheet] = useState<SheetKind | null>(null);
  const [stage, setStage] = useState<StageTarget | null>(null);

  const { offer } = room;
  const pickTab = useCallback((next: RoomTab) => {
    setTab(next);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", next);
      window.history.replaceState(null, "", url);
    } catch {
      /* the address is a convenience */
    }
  }, []);

  const steps: TrackStep[] = trackFor(room).map((s) => ({ key: s.key, label: s.label, state: s.state, ...(s.note ? { note: s.note } : {}), ...(s.when ? { when: s.when } : {}) }));
  const at = steps.findIndex((x) => x.state === "current" || x.state === "failed");
  const here = steps[at >= 0 ? at : steps.length - 1];
  const progressLine = here ? `Step ${(at >= 0 ? at : steps.length - 1) + 1} of ${steps.length}: ${here.label}${here.note ? `, ${here.note.toLowerCase()}` : ""}` : "Progress";
  const progressHint = "See every step";
  const question = hasOpenQuestion(room);
  const recordable = offer.state === "agreed" ? nextRecordableStage(offer.stage) : null;
  const live = offer.state === "open" || offer.state === "agreed";

  /* The one primary action. */
  let primary: { label: string; run: () => void; icon?: "check" | "chat-bubble" | "calendar-booking" | "document" } | null = null;
  const next = room.next;
  if (offer.state === "open" && next?.kind === "respond") primary = { label: next.label || "Respond to this offer", run: () => setSheet("respond") };
  else if (offer.state === "open" && next?.kind === "accept_counter") primary = { label: next.label || "Review the counteroffer", run: () => setSheet("decide_counter") };
  else if (offer.state === "open" && question) primary = { label: "Answer the question", run: () => setSheet("answer") };
  else if (next?.kind === "schedule_inspection") primary = { label: next.label, run: () => pickTab("inspection"), icon: "calendar-booking" };
  else if (next?.kind === "upload_document" || next?.kind === "review_document") primary = { label: next.label, run: () => pickTab("documents"), icon: "document" };
  else if (recordable) primary = { label: RECORD_STAGE_BUTTON[recordable], run: () => { setStage(recordable); setSheet("stage"); } };

  const quiet: { label: string; run: () => void }[] = [];
  if (offer.state === "open" && room.viewerSide === "buyer" && !primary) quiet.push({ label: "Withdraw offer", run: () => setSheet("withdraw") });
  if (live) quiet.push({ label: "Raise a concern", run: () => setSheet("dispute") });

  const actionBlock = (
    <Panel variant="card" className="grid gap-sm p-card" data-testid="next-action">
      <p className="nf-section-label">Next</p>
      {primary ? (
        <>
          <p className="nf-body text-[var(--nf-content-secondary)]">{room.next?.detail}</p>
          <Button variant="primary" size="lg" full onClick={primary.run} {...(primary.icon ? { leadingIcon: primary.icon } : {})} data-testid="primary-action">
            {primary.label}
          </Button>
        </>
      ) : (
        <>
          <p className="nf-body text-[var(--nf-content-secondary)]">{room.next?.detail ?? (live ? "Nothing is waiting on you." : "This offer is closed. Nothing is waiting.")}</p>
          {live && room.conversationId ? (
            <Button variant="secondary" size="lg" full leadingIcon="chat-bubble" onClick={() => pickTab("messages")} data-testid="primary-action">
              Open the conversation
            </Button>
          ) : (
            <ButtonLink href={`/listing/${offer.listingId}`} variant="secondary" size="lg" full data-testid="primary-action">
              Return to property
            </ButtonLink>
          )}
        </>
      )}
      {quiet.length ? (
        <div className="flex flex-wrap gap-xs">
          {quiet.map((q) => (
            <Button key={q.label} variant="quiet" size="sm" onClick={q.run}>
              {q.label}
            </Button>
          ))}
        </div>
      ) : null}
    </Panel>
  );

  const phoneOptions = ROOM_TABS.map((t) => ({ value: t, label: ROOM_TAB_LABEL[t] }));
  const wideOptions = phoneOptions.filter((o) => o.value !== "overview");
  const wideTab = (tab === "overview" ? "negotiation" : tab) as RoomTab;

  return (
    <div className="nf-room" data-tab={tab} data-testid="deal-room">
      <header className="nf-room__head">
        <div className="nf-room__thumb" aria-hidden="true">
          {offer.listingThumb ? <RemoteImage src={offer.listingThumb} alt="" width={112} height={112} sizes="56px" /> : <UiIcon name="house" size={24} />}
        </div>
        <div className="min-w-0 grid gap-3xs">
          <p className="nf-room__ref">
            {offer.reference} · {room.viewerSide === "buyer" ? "Seller" : "Buyer"}: {offer.counterpartyName}
          </p>
          <h1 className="nf-room__title">{offer.listingTitle}</h1>
          <div>
            <OfferStateChip row={offer} size="md" />
          </div>
        </div>
      </header>

      <div className="lg:hidden">
        <Disclosure inline label={progressLine} hint={progressHint} data-testid="deal-progress">
          <StatusTrack steps={steps} label="Deal progress" testId="deal-track" />
        </Disclosure>
      </div>
      <div className="hidden lg:block">
        <StatusTrack steps={steps} label="Deal progress" title="Progress" testId="deal-track-wide" />
      </div>

      <div className="nf-room__tabs lg:hidden">
        <RoomTabs options={phoneOptions} value={tab} onChange={pickTab} />
      </div>
      <div className="nf-room__tabs hidden lg:block">
        <RoomTabs options={wideOptions} value={wideTab} onChange={pickTab} />
      </div>

      <div className="nf-room__cols">
        <div className="min-w-0 grid gap-md">
          <section data-panel="overview" className="nf-room__panel nf-room__panel--overview lg:hidden" hidden={tab !== "overview"} aria-label="Overview">
            <OverviewPanel room={room} nowMs={nowMs} action={actionBlock} />
          </section>
          <section data-panel="negotiation" className="nf-room__panel" hidden={wideTab !== "negotiation" || tab === "overview"} data-wide-show={tab === "overview" ? "" : undefined} aria-label="Negotiation">
            <NegotiationPanel room={room} />
          </section>
          <section data-panel="messages" className="nf-room__panel" hidden={tab !== "messages"} aria-label="Messages">
            <MessagesPanel room={room} thread={thread} />
          </section>
          <section data-panel="inspection" className="nf-room__panel" hidden={tab !== "inspection"} aria-label="Inspection">
            <InspectionPanel room={room} />
          </section>
          <section data-panel="documents" className="nf-room__panel" hidden={tab !== "documents"} aria-label="Documents">
            <DocumentsPanel room={room} />
          </section>
          <section data-panel="activity" className="nf-room__panel" hidden={tab !== "activity"} aria-label="Activity">
            <ActivityPanel room={room} />
          </section>
        </div>
        <aside className="nf-room__side hidden lg:block" aria-label="Overview">
          <OverviewPanel room={room} nowMs={nowMs} action={actionBlock} />
        </aside>
      </div>

      <div className="nf-room__foot-spacer lg:hidden" aria-hidden="true" />
      {primary ? (
        <ActionBar className="lg:hidden">
          <Button variant="primary" size="lg" full onClick={primary.run} data-testid="foot-action">
            {primary.label}
          </Button>
        </ActionBar>
      ) : null}

      <DealSheets room={room} kind={sheet} stage={stage} onKind={setSheet} onClose={() => setSheet(null)} />
    </div>
  );
}

/** The section tabs: a row of words on a hairline that scrolls sideways on a phone and never wraps. */
function RoomTabs({ options, value, onChange }: { options: { value: RoomTab; label: string }[]; value: RoomTab; onChange: (tab: RoomTab) => void }) {
  const move = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const at = options.findIndex((o) => o.value === value);
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = options[(at + step + options.length) % options.length];
    if (next) {
      onChange(next.value);
      (event.currentTarget.querySelector(`[data-tab-key="${next.value}"]`) as HTMLElement | null)?.focus();
    }
  };
  return (
    <div className="nf-utabs" data-testid="room-tabs">
      <div className="nf-utabs__row" role="tablist" aria-label="Deal Room sections" onKeyDown={move}>
        {options.map((o) => (
          <button key={o.value} type="button" role="tab" data-tab-key={o.value} aria-selected={o.value === value} aria-current={o.value === value ? "page" : undefined} tabIndex={o.value === value ? 0 : -1} className="nf-utabs__tab" onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
