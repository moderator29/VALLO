"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { InterestSheet } from "@/components/roommates/Actions";
import { dayText, fill, naira } from "@/components/roommates/format";
import { ShareComposer } from "@/components/share/ShareComposer";
import { type ShareCopy } from "@/components/share/ShareSheet";
import { plural, type PluralForms } from "@vallo/i18n/core";
import { Button, ButtonLink } from "@/components/ui/Button";
import { TextArea, TextField } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { useScopedCopy } from "@/lib/i18n/copy-scope";
import {
  addToGroupShortlist,
  deleteRoommateListing,
  openRoommateChat,
  recordRoommateListingView,
  requestRoommateViewing,
  setRoommateListingStatus,
  shareRoommateListingToFeed,
} from "@/lib/features/roommates/actions";
import { LIMITS, ROOMMATES_ROUTES, monthlyMinor, type ConnectionState, type ListingStatus, type Period, type ViewingMode, type ViewingStatus } from "@/lib/features/roommates/model";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { shareOrCopy } from "@/lib/ui/clipboard";
import { feedback } from "@/lib/ui/feedback";
import { banner } from "@/lib/ui/toast";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

type Result = { ok: true } | { ok: false; error: string };

function useRun() {
  const [pending, start] = useSafeTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const run = (key: string, task: () => Promise<Result>) =>
    start(async () => {
      setBusy(key);
      try {
        const result = await task();
        if (!result.ok) {
          feedback("error");
          banner.error(result.error, { retry: () => run(key, task) });
        }
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      } finally {
        setBusy(null);
      }
    });
  return { pending, busy, run };
}

/** Counts the view once on arrival (the database keeps one per viewer per day). Never fails the page. */
export function RecordView({ id }: { id: string }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void recordRoommateListingView(id).catch(() => undefined);
  }, [id]);
  return null;
}

export type ListingActionsProps = {
  id: string;
  title: string;
  status: ListingStatus;
  isOwner: boolean;
  signedIn: boolean;
  owner: { userId: string; name: string };
  connection: ConnectionState;
  myViewing: { id: string; status: ViewingStatus; proposedAt: string } | null;
  groups: { id: string; name: string }[];
  viewCount: number;
  interestCount: number;
  /** Open the viewing request on arrival (the hub links with `?viewing=1`). */
  openViewing?: boolean;
};

/**
 * THE LISTING'S ACTIONS. The owner manages the post (edit, pause or turn on,
 * filled, delete behind a confirm). Anybody else: interested, a viewing
 * request, the group shortlist. Every answer is a banner; a refusal offers
 * Try again.
 */
export function ListingActions(props: ListingActionsProps) {
  const copy = useScopedCopy("roommates");
  const L = copy.ui.listing;
  const router = useRouter();
  const { pending, busy, run } = useRun();
  const [status, setStatus] = useState<ListingStatus>(props.status);
  const [connection, setConnection] = useState<ConnectionState>(props.connection);
  const [sheet, setSheet] = useState<null | "delete" | "interest" | "viewing" | "shortlist">(
    props.openViewing && props.signedIn && !props.isOwner && !props.myViewing ? "viewing" : null,
  );
  const close = () => setSheet(null);
  const first = props.owner.name.split(" ")[0] ?? props.owner.name;

  if (props.isOwner) {
    const setTo = (next: "live" | "paused" | "filled", words: string) =>
      run(next, async () => {
        const result = await setRoommateListingStatus({ id: props.id, status: next });
        if (!result.ok) return result;
        feedback("confirm");
        setStatus(next);
        banner.success(words);
        router.refresh();
        return { ok: true };
      });
    return (
      <div className="nf-rmv-act" data-testid="listing-owner-actions">
        <p className="nf-rmv-act__line nf-rmv-act__line--strong">
          <UiIcon name="file-check" size={16} />
          {fill(L.ownerStatus, { status: copy.listingStatus[status] })}
        </p>
        <p className="nf-rmv-act__line">{fill(L.stats, { views: props.viewCount, interests: props.interestCount })}</p>
        <ButtonLink href={ROOMMATES_ROUTES.editListing(props.id)} variant="primary" size="lg" full leadingIcon="pencil">
          {L.edit}
        </ButtonLink>
        <div className="nf-rmv-act__pair">
          {status === "live" ? (
            <Button variant="secondary" size="md" full loading={pending && busy === "paused"} disabled={pending} onClick={() => setTo("paused", L.paused)}>
              {copy.actions.pause}
            </Button>
          ) : status === "paused" || status === "filled" ? (
            <Button variant="secondary" size="md" full loading={pending && busy === "live"} disabled={pending} onClick={() => setTo("live", L.resumed)}>
              {copy.actions.resume}
            </Button>
          ) : null}
          {status === "live" || status === "paused" ? (
            <Button variant="secondary" size="md" full loading={pending && busy === "filled"} disabled={pending} onClick={() => setTo("filled", L.filled)}>
              {copy.actions.markFilled}
            </Button>
          ) : null}
        </div>
        <Button variant="dangerQuiet" size="md" full leadingIcon="trash" onClick={() => setSheet("delete")} data-testid="listing-delete">
          {copy.actions.delete}
        </Button>
        <Sheet
          open={sheet === "delete"}
          onOpenChange={(o) => setSheet(o ? "delete" : null)}
          title={L.deleteTitle}
          description={L.deleteBody}
          detents={[0.45]}
          footer={
            <div className="nf-rm-sheetfoot">
              <Button variant="secondary" size="lg" full onClick={close}>
                {L.keep}
              </Button>
              <Button
                variant="danger"
                size="lg"
                full
                loading={pending && busy === "delete"}
                data-testid="listing-delete-confirm"
                onClick={() =>
                  run("delete", async () => {
                    const result = await deleteRoommateListing(props.id);
                    if (!result.ok) return result;
                    feedback("confirm");
                    banner.success(L.deleted);
                    close();
                    router.push(ROOMMATES_ROUTES.hub);
                    return { ok: true };
                  })
                }
              >
                {copy.actions.delete}
              </Button>
            </div>
          }
        >
          <p className="nf-rm-sheetline">{L.deleteBody}</p>
        </Sheet>
      </div>
    );
  }

  if (!props.signedIn) {
    return (
      <div className="nf-rmv-act" data-testid="listing-actions">
        <p className="nf-rmv-act__line">{L.signInToAct}</p>
        <ButtonLink href={`/sign-in?next=${encodeURIComponent(ROOMMATES_ROUTES.listing(props.id))}`} variant="primary" size="lg" full data-testid="listing-sign-in">
          {copy.ui.signInContinue}
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="nf-rmv-act" data-testid="listing-actions">
      {connection.state === "none" || connection.state === "declined" ? (
        <Button variant="primary" size="lg" full leadingIcon="heart" onClick={() => setSheet("interest")} disabled={connection.state === "declined"} data-testid="listing-interested">
          {connection.state === "declined" ? copy.connection.declined : copy.actions.interested}
        </Button>
      ) : connection.state === "sent" ? (
        <p className="nf-rmv-act__line nf-rmv-act__line--strong">
          <UiIcon name="hourglass" size={16} />
          {copy.connection.sent}
        </p>
      ) : connection.state === "received" ? (
        <ButtonLink href={ROOMMATES_ROUTES.person(props.owner.userId)} variant="primary" size="lg" full>
          {fill(copy.connection.received, { name: first })}
        </ButtonLink>
      ) : (
        <Button
          variant="primary"
          size="lg"
          full
          leadingIcon="chat-bubble"
          loading={pending && busy === "chat"}
          data-testid="listing-message"
          onClick={() =>
            run("chat", async () => {
              if (connection.conversationId) {
                router.push(`/messages/${connection.conversationId}`);
                return { ok: true };
              }
              const result = await openRoommateChat(connection.interestId);
              if (!result.ok) return result;
              router.push(`/messages/${result.data.conversationId}`);
              return { ok: true };
            })
          }
        >
          {copy.actions.message}
        </Button>
      )}

      {props.myViewing ? (
        <p className="nf-rmv-act__line">
          <UiIcon name="calendar-clock" size={16} />
          {fill(L.yourViewing, { status: copy.viewings.status[props.myViewing.status].toLowerCase(), date: dayText(props.myViewing.proposedAt) })}
        </p>
      ) : (
        <Button variant="secondary" size="lg" full leadingIcon="calendar-booking" aria-label={copy.actions.requestViewing} onClick={() => setSheet("viewing")} data-testid="listing-viewing">
          {copy.actions.requestViewing}
        </Button>
      )}

      {props.groups.length ? (
        <Button variant="quiet" size="md" full leadingIcon="circle-people" onClick={() => setSheet("shortlist")} data-testid="listing-shortlist">
          {copy.actions.addToShortlist}
        </Button>
      ) : null}

      <InterestSheet
        open={sheet === "interest"}
        onOpenChange={(o) => setSheet(o ? "interest" : null)}
        toId={props.owner.userId}
        name={first}
        listingId={props.id}
        title={L.interestTitle}
        body={fill(L.interestBody, { name: first })}
        onSent={(interestId) => {
          setConnection({ state: "sent", interestId });
          router.refresh();
        }}
      />
      <ViewingSheet open={sheet === "viewing"} onOpenChange={(o) => setSheet(o ? "viewing" : null)} listingId={props.id} />
      <Sheet open={sheet === "shortlist"} onOpenChange={(o) => setSheet(o ? "shortlist" : null)} title={L.shortlistTitle} description={L.shortlistBody} closeLabel={copy.ui.flow.close} detents={[0.6]}>
        <ul className="nf-rmv-picklist">
          {props.groups.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                className="nf-rmv-pick"
                disabled={pending}
                onClick={() =>
                  run(`sl-${g.id}`, async () => {
                    const result = await addToGroupShortlist({ groupId: g.id, roommateListingId: props.id });
                    if (!result.ok) return result;
                    feedback("confirm");
                    banner.success(`${L.shortlisted}: ${g.name}`);
                    close();
                    return { ok: true };
                  })
                }
              >
                <span className="nf-rm-plate" aria-hidden="true">
                  <UiIcon name="circle-people" size={20} />
                </span>
                <span className="nf-rmv-pick__name">{g.name}</span>
                <UiIcon name={busy === `sl-${g.id}` ? "hourglass" : "plus"} size={18} />
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </div>
  );
}

/** "2026-11-12T15:30" from the picker, as the instant it names on this device. */
function instant(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function ViewingSheet({ open, onOpenChange, listingId }: { open: boolean; onOpenChange: (o: boolean) => void; listingId: string }) {
  const copy = useScopedCopy("roommates");
  const L = copy.ui.listing;
  const router = useRouter();
  const [mode, setMode] = useState<ViewingMode>("in_person");
  const [at, setAt] = useState("");
  const [alt, setAlt] = useState("");
  const [note, setNote] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, start] = useSafeTransition();

  const send = () =>
    start(async () => {
      const proposedAt = instant(at);
      if (!proposedAt) {
        setProblem(L.whenMissing);
        feedback("error");
        return;
      }
      setProblem(null);
      try {
        const result = await requestRoommateViewing({ listingId, mode, proposedAt, altAt: instant(alt), note });
        if (!result.ok) {
          feedback("error");
          if (result.fieldErrors?.proposedAt) setProblem(result.fieldErrors.proposedAt);
          banner.error(result.error, { retry: send });
          return;
        }
        feedback("confirm");
        banner.success(L.requested);
        onOpenChange(false);
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={L.viewing}
      description={L.viewingBody}
      closeLabel={copy.ui.flow.close}
      footer={
        <Button variant="primary" size="lg" full loading={pending} onClick={send} data-testid="viewing-send">
          {L.sendRequest}
        </Button>
      }
      testId="listing-viewing-sheet"
    >
      <div className="nf-rmd-sheet">
        <Segmented<ViewingMode>
          variant="solid"
          label={L.mode}
          semantics="radio"
          full
          value={mode}
          options={[
            { value: "in_person", label: copy.viewings.inPerson, icon: "house" },
            { value: "virtual", label: copy.viewings.virtual, icon: "video" },
          ]}
          onChange={setMode}
        />
        <TextField label={L.when} type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} error={problem ?? undefined} required data-testid="viewing-at" />
        <TextField label={L.alt} optionalText={copy.ui.flow.optional} type="datetime-local" value={alt} onChange={(e) => setAlt(e.target.value)} />
        <TextArea label={L.note} optionalText={copy.ui.flow.optional} value={note} maxLength={LIMITS.noteMax} rows={3} onChange={(e) => setNote(e.target.value)} />
        <p className="nf-rm-note">
          <UiIcon name="info" size={16} />
          {copy.viewings.notReserved}
        </p>
      </div>
    </Sheet>
  );
}

/** Share: the link (the system sheet, or the clipboard), and for a member, to their feed with a line of their own. */
export function ListingShareMenu({
  id,
  title,
  signedIn,
  cover,
  priceMinor,
  period,
  roomsFree,
  shareCopy,
  shareWords,
}: {
  id: string;
  title: string;
  signedIn: boolean;
  cover?: string;
  priceMinor?: number | null;
  period?: Period;
  roomsFree?: number | null;
  shareCopy?: ShareCopy;
  shareWords?: { cover: string; perMonth: string; roomsFree: PluralForms; listingLead: string; priceLead: string; makeCard: string };
}) {
  const copy = useScopedCopy("roommates");
  const L = copy.ui.listing;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [feed, setFeed] = useState(false);
  const [card, setCard] = useState(false);
  const [line, setLine] = useState("");
  const [pending, start] = useSafeTransition();

  const link = async () => {
    feedback("select");
    const outcome = await shareOrCopy({ url: `${window.location.origin}${ROOMMATES_ROUTES.listing(id)}`, title });
    if (outcome === "copied") banner.success(copy.ui.profile.shared);
    else if (outcome === "shared") banner.success(copy.ui.profile.sharedNative);
    else if (outcome === "failed") banner.error(copy.ui.profile.shareFailed);
    if (outcome !== "cancelled") setOpen(false);
  };

  const monthly = typeof priceMinor === "number" ? monthlyMinor(priceMinor, period ?? "year") : null;
  const stats =
    shareWords && (monthly !== null || typeof roomsFree === "number")
      ? [
          monthly !== null ? { value: naira(monthly), label: shareWords.perMonth } : null,
          typeof roomsFree === "number" && roomsFree > 0 ? { value: String(roomsFree), label: plural(roomsFree, shareWords.roomsFree, "en").replace(/^[\d,.]+\s*/, "") } : null,
        ].filter((x): x is { value: string; label: string } => x !== null)
      : [];
  const shareSubject =
    shareWords
      ? {
          ...(cover ? { avatar: cover } : { initial: title }),
          headline: title,
          stats,
          url: ROOMMATES_ROUTES.listing(id),
          ...(monthly !== null
            ? { leads: [
                { id: "listing", label: shareWords.listingLead, headline: title },
                { id: "price", label: shareWords.priceLead, headline: naira(monthly), sub: shareWords.perMonth },
              ] }
            : {}),
        }
      : null;
  const shareBackgrounds = cover ? [{ id: "cover", label: shareWords?.cover ?? "Photo", kind: "image" as const, src: cover }, { id: "glow", label: "Brand glow", kind: "aurora" as const, variant: "glow" as const }, { id: "ink", label: "Night", kind: "aurora" as const, variant: "ink" as const }] : undefined;

  const post = () =>
    start(async () => {
      try {
        const result = await shareRoommateListingToFeed({ listingId: id, body: line });
        if (!result.ok) {
          feedback("error");
          banner.error(result.error, { retry: post });
          return;
        }
        feedback("confirm");
        setOpen(false);
        setFeed(false);
        setLine("");
        banner.success(L.feedShared, { action: { label: L.feedOpen, run: () => router.push("/around") } });
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });

  return (
    <>
      <Button variant="icon" round iconOnly aria-label={copy.actions.share} onClick={() => setOpen(true)} data-testid="listing-share">
        <UiIcon name="share" size={20} />
      </Button>
      <Sheet
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            setFeed(false);
            setCard(false);
          }
        }}
        title={card ? copy.actions.share : feed ? L.feedTitle : copy.actions.share}
        {...(feed ? { description: L.feedBody } : {})}
        closeLabel={copy.ui.flow.close}
        detents={card ? [0.92] : [0.55]}
        {...(feed
          ? {
              footer: (
                <Button variant="primary" size="lg" full loading={pending} onClick={post} data-testid="listing-share-feed-send">
                  {L.feedSend}
                </Button>
              ),
            }
          : {})}
      >
        {card && shareSubject && shareCopy ? (
          <ShareComposer subject={shareSubject} backgrounds={shareBackgrounds} copy={shareCopy} />
        ) : feed ? (
          <TextArea label={L.feedLine} optionalText={copy.ui.flow.optional} value={line} maxLength={2000} rows={4} onChange={(e) => setLine(e.target.value)} />
        ) : (
          <ul className="nf-rmv-picklist">
            {shareSubject && shareCopy ? (
              <li>
                <button type="button" className="nf-rmv-pick" onClick={() => { feedback("select"); setCard(true); }} data-testid="listing-share-card">
                  <span className="nf-rm-plate" aria-hidden="true">
                    <UiIcon name="stack" size={20} />
                  </span>
                  <span className="nf-rmv-pick__name">{shareWords?.makeCard ?? L.shareLink}</span>
                  <UiIcon name="chevron-right" size={18} />
                </button>
              </li>
            ) : null}
            <li>
              <button type="button" className="nf-rmv-pick" onClick={link}>
                <span className="nf-rm-plate" aria-hidden="true">
                  <UiIcon name="link" size={20} />
                </span>
                <span className="nf-rmv-pick__name">{L.shareLink}</span>
                <UiIcon name="chevron-right" size={18} />
              </button>
            </li>
            {signedIn ? (
              <li>
                <button
                  type="button"
                  className="nf-rmv-pick"
                  onClick={() => {
                    feedback("select");
                    setOpen(false);
                    router.push(`/messages/share/roommate/${id}`);
                  }}
                  data-testid="listing-share-chat"
                >
                  <span className="nf-rm-plate" aria-hidden="true">
                    <UiIcon name="chat-bubble" size={20} />
                  </span>
                  <span className="nf-rmv-pick__name">{L.shareChat}</span>
                  <UiIcon name="chevron-right" size={18} />
                </button>
              </li>
            ) : null}
            {signedIn ? (
              <li>
                <button
                  type="button"
                  className="nf-rmv-pick"
                  onClick={() => {
                    feedback("select");
                    setFeed(true);
                  }}
                  data-testid="listing-share-feed"
                >
                  <span className="nf-rm-plate" aria-hidden="true">
                    <UiIcon name="feed" size={20} />
                  </span>
                  <span className="nf-rmv-pick__name">{L.feedTitle}</span>
                  <UiIcon name="chevron-right" size={18} />
                </button>
              </li>
            ) : null}
          </ul>
        )}
      </Sheet>
    </>
  );
}
