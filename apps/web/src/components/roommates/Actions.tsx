"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { useScopedCopy } from "@/lib/i18n/copy-scope";
import { expressInterest } from "@/lib/features/roommates/actions";
import { listSavedPlaces, savePlace, unsavePlace } from "@/lib/saved/places-actions";
import { LIMITS } from "@/lib/features/roommates/model";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { blockUserSafely } from "@/lib/safety/blocks-actions";
import { shareOrCopy } from "@/lib/ui/clipboard";
import { feedback } from "@/lib/ui/feedback";
import { banner } from "@/lib/ui/toast";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

import { fill } from "./format";

/* The report sheet carries the report words (the dictionary), so it arrives
   on demand rather than in this route's first load. */
const ReportSheet = dynamic(() => import("@/components/app/ReportSheet").then((m) => m.ReportSheet), { ssr: false });

/**
 * VALLO ROOMMATES, THE SHARED CLIENT CONTROLS: save, share, the safety rows
 * (report and block) and the "I'm interested" sheet. Words come from the
 * route's scope (`useScopedCopy("roommates")`).
 */

/* ------------------------------------------------------------------ save */

/**
 * Save to the account's shortlist (`saved_places`, kinds `roommate_profile`
 * and `roommate_listing`). Optimistic: the mark turns at once and turns back,
 * with the banner and Try again, if the server refuses.
 */
export function SaveButton({ kind, id, signedIn = true }: { kind: "person" | "room"; id: string; signedIn?: boolean }) {
  const copy = useScopedCopy("roommates");
  const router = useRouter();
  const entityKind = kind === "person" ? "roommate_profile" : "roommate_listing";
  const [saved, setSaved] = useState(false);
  const [pending, start] = useSafeTransition();
  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    void listSavedPlaces({ entityKind })
      .then((result) => {
        if (live && result.ok) setSaved(result.data.some((p) => p.entityId === id));
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [entityKind, id, signedIn]);

  const toggle = () =>
    start(async () => {
      if (!signedIn) {
        router.push(`/sign-in?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      const want = !saved;
      feedback("select");
      setSaved(want);
      try {
        const result = want ? await savePlace({ entityKind, entityId: id }) : await unsavePlace({ entityKind, entityId: id });
        if (!result.ok) {
          setSaved(!want);
          banner.error(result.error, { retry: toggle });
          return;
        }
        if (want) banner.success(copy.actions.saved);
        else banner.info(copy.ui.profile.removedSave);
      } catch (error) {
        setSaved(!want);
        if (!tapFailedOffline(error)) throw error;
      }
    });

  return (
    <Button variant="icon" round iconOnly aria-label={saved ? copy.actions.saved : copy.actions.save} aria-pressed={saved} disabled={pending} data-testid="roommates-save" onClick={toggle}>
      <UiIcon name="bookmark" size={20} filled={saved} />
    </Button>
  );
}

export function ShareButton({ path, title }: { path: string; title: string }) {
  const copy = useScopedCopy("roommates");
  return (
    <Button
      variant="icon"
      round
      iconOnly
      aria-label={copy.actions.share}
      data-testid="roommates-share"
      onClick={async () => {
        feedback("select");
        const outcome = await shareOrCopy({ url: `${window.location.origin}${path}`, title });
        if (outcome === "copied") banner.success(copy.ui.profile.shared);
        else if (outcome === "shared") banner.success(copy.ui.profile.sharedNative);
        else if (outcome === "failed") banner.error(copy.ui.profile.shareFailed);
      }}
    >
      <UiIcon name="share" size={20} />
    </Button>
  );
}

/* ------------------------------------------------------------------ report and block */

export function SafetyRows({
  targetType,
  targetId,
  label,
  userId,
  name,
  signedIn,
}: {
  targetType: "roommate_profile" | "roommate_listing";
  targetId: string;
  label: string;
  /** The person to block, when the page is about somebody else. */
  userId?: string | null;
  name: string;
  signedIn: boolean;
}) {
  const copy = useScopedCopy("roommates");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useSafeTransition();

  const block = () =>
    start(async () => {
      if (!userId) return;
      try {
        const result = await blockUserSafely({ userId });
        if (!result.ok) {
          feedback("error");
          banner.error(result.error, { retry: block });
          return;
        }
        feedback("confirm");
        setOpen(false);
        banner.success(copy.ui.profile.blocked);
        router.push("/roommates");
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });

  return (
    <div className="nf-rm-safety" data-testid="roommates-safety-rows">
      {/* The kinds `roommate_profile` and `roommate_listing` join REPORT_TARGETS with FE-B's report-target work. */}
      <ReportSheet targetType={targetType} targetId={targetId} targetLabel={label} signedIn={signedIn} trigger="row" />
      {userId && signedIn ? (
        <>
          <button type="button" className="nf-share-row mt-md w-full text-left" onClick={() => setOpen(true)} data-testid="roommates-block">
            <span className="nf-rm-plate" aria-hidden="true">
              <UiIcon name="block" size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block nf-body font-semibold text-[var(--nf-content-primary)]">{fill(copy.ui.profile.blockTitle, { name })}</span>
              <span className="block nf-caption text-[var(--nf-content-muted)]">{copy.ui.profile.blockLine}</span>
            </span>
            <UiIcon name="chevron-right" size={16} />
          </button>
          <Sheet
            open={open}
            onOpenChange={setOpen}
            title={fill(copy.ui.profile.blockTitle, { name })}
            description={copy.ui.profile.blockLine}
            detents={[0.5]}
            footer={
              <div className="nf-rm-sheetfoot">
                <Button variant="secondary" size="lg" full onClick={() => setOpen(false)}>
                  {copy.ui.listing.keep}
                </Button>
                <Button variant="danger" size="lg" full loading={pending} onClick={block} data-testid="roommates-block-confirm">
                  {copy.actions.block}
                </Button>
              </div>
            }
          >
            <p className="nf-rm-sheetline">{copy.ui.safety.reportBody}</p>
          </Sheet>
        </>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ interest */

/** The "I'm interested" sheet (the reference's invite modal): who, one sentence, an optional note, send. */
export function InterestSheet({
  open,
  onOpenChange,
  toId,
  name,
  listingId,
  title,
  body,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toId: string;
  name: string;
  listingId?: string | null;
  title?: string;
  body?: string;
  onSent: (interestId: string) => void;
}) {
  const copy = useScopedCopy("roommates");
  const [note, setNote] = useState("");
  const [pending, start] = useSafeTransition();
  const send = () =>
    start(async () => {
      try {
        const result = await expressInterest({ toId, listingId: listingId ?? null, note });
        if (!result.ok) {
          feedback("error");
          banner.error(result.error, { retry: send });
          return;
        }
        feedback("confirm");
        banner.success(copy.ui.profile.sentBanner);
        setNote("");
        onOpenChange(false);
        onSent(result.data.id);
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={title ?? copy.ui.profile.interestTitle}
      description={body ?? fill(copy.ui.profile.interestBody, { name })}
      closeLabel={copy.ui.flow.close}
      footer={
        <div className="nf-rm-sheetfoot">
          <Button variant="secondary" size="lg" full onClick={() => onOpenChange(false)}>
            {copy.ui.profile.cancel}
          </Button>
          <Button variant="primary" size="lg" full loading={pending} onClick={send} data-testid="roommates-interest-send">
            {copy.ui.profile.send}
          </Button>
        </div>
      }
      testId="roommates-interest-sheet"
    >
      <TextArea
        label={copy.ui.profile.noteLabel}
        optionalText={copy.ui.flow.optional}
        placeholder={copy.ui.profile.notePlaceholder}
        value={note}
        maxLength={LIMITS.noteMax}
        rows={4}
        onChange={(e) => setNote(e.target.value)}
      />
    </Sheet>
  );
}
