"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ReportSheet } from "@/components/app/ReportSheet";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { useScopedCopy } from "@/lib/i18n/copy-scope";
import { expressInterest } from "@/lib/features/roommates/actions";
import { LIMITS } from "@/lib/features/roommates/model";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import type { ReportTarget } from "@/lib/reports/categories";
import { blockUserSafely } from "@/lib/safety/blocks-actions";
import { shareOrCopy } from "@/lib/ui/clipboard";
import { feedback } from "@/lib/ui/feedback";
import { banner } from "@/lib/ui/toast";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

import { fill } from "./format";

/**
 * VALLO ROOMMATES, THE SHARED CLIENT CONTROLS: save, share, the safety rows
 * (report and block) and the "I'm interested" sheet. Words come from the
 * route's scope (`useScopedCopy("roommates")`).
 */

/* ------------------------------------------------------------------ save on this device */

const SAVE_KEY = "vallo.roommates.saved.v1";
type SavedKind = "person" | "room";

function readSaved(): string[] {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    const v = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
function writeSaved(list: string[]) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(list.slice(-200)));
  } catch {
    /* No storage: the save is simply not kept. */
  }
}

/**
 * Save, kept on this device. The contract has no saved-items kind for a
 * roommate or a room yet (reported to the lead), so the banner says exactly
 * where it is kept rather than claiming an account save.
 */
export function SaveButton({ kind, id }: { kind: SavedKind; id: string }) {
  const t = useScopedCopy("roommates");
  const key = `${kind}:${id}`;
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the device list is read after hydration, so server and first client render agree
    setSaved(readSaved().includes(key));
  }, [key]);
  return (
    <Button
      variant="icon"
      round
      iconOnly
      aria-label={saved ? t.actions.saved : t.actions.save}
      aria-pressed={saved}
      data-testid="roommates-save"
      onClick={() => {
        feedback("select");
        const list = readSaved().filter((k) => k !== key);
        if (!saved) list.push(key);
        writeSaved(list);
        setSaved(!saved);
        if (saved) banner.info(t.ui.profile.removedSave);
        else banner.success(t.ui.profile.savedDevice);
      }}
    >
      <UiIcon name="bookmark" size={20} filled={saved} />
    </Button>
  );
}

export function ShareButton({ path, title }: { path: string; title: string }) {
  const t = useScopedCopy("roommates");
  return (
    <Button
      variant="icon"
      round
      iconOnly
      aria-label={t.actions.share}
      data-testid="roommates-share"
      onClick={async () => {
        feedback("select");
        const outcome = await shareOrCopy({ url: `${window.location.origin}${path}`, title });
        if (outcome === "copied") banner.success(t.ui.profile.shared);
        else if (outcome === "shared") banner.success(t.ui.profile.sharedNative);
        else if (outcome === "failed") banner.error(t.ui.profile.shareFailed);
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
  const t = useScopedCopy("roommates");
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
        banner.success(t.ui.profile.blocked);
        router.push("/roommates");
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });

  return (
    <div className="nf-rm-safety" data-testid="roommates-safety-rows">
      {/* The kinds `roommate_profile` and `roommate_listing` join REPORT_TARGETS with FE-B's report-target work. */}
      <ReportSheet targetType={targetType as ReportTarget} targetId={targetId} targetLabel={label} signedIn={signedIn} trigger="row" />
      {userId && signedIn ? (
        <>
          <button type="button" className="nf-share-row mt-md w-full text-left" onClick={() => setOpen(true)} data-testid="roommates-block">
            <span className="nf-rm-plate" aria-hidden="true">
              <UiIcon name="block" size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block nf-body font-semibold text-[var(--nf-content-primary)]">{fill(t.ui.profile.blockTitle, { name })}</span>
              <span className="block nf-caption text-[var(--nf-content-muted)]">{t.ui.profile.blockLine}</span>
            </span>
            <UiIcon name="chevron-right" size={16} />
          </button>
          <Sheet
            open={open}
            onOpenChange={setOpen}
            title={fill(t.ui.profile.blockTitle, { name })}
            description={t.ui.profile.blockLine}
            detents={[0.5]}
            footer={
              <div className="nf-rm-sheetfoot">
                <Button variant="secondary" size="lg" full onClick={() => setOpen(false)}>
                  {t.ui.listing.keep}
                </Button>
                <Button variant="danger" size="lg" full loading={pending} onClick={block} data-testid="roommates-block-confirm">
                  {t.actions.block}
                </Button>
              </div>
            }
          >
            <p className="nf-rm-sheetline">{t.ui.safety.reportBody}</p>
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
  const t = useScopedCopy("roommates");
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
        banner.success(t.ui.profile.sentBanner);
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
      title={title ?? t.ui.profile.interestTitle}
      description={body ?? fill(t.ui.profile.interestBody, { name })}
      closeLabel={t.ui.flow.close}
      footer={
        <div className="nf-rm-sheetfoot">
          <Button variant="secondary" size="lg" full onClick={() => onOpenChange(false)}>
            {t.ui.profile.cancel}
          </Button>
          <Button variant="primary" size="lg" full loading={pending} onClick={send} data-testid="roommates-interest-send">
            {t.ui.profile.send}
          </Button>
        </div>
      }
      testId="roommates-interest-sheet"
    >
      <TextArea
        label={t.ui.profile.noteLabel}
        optionalText={t.ui.flow.optional}
        placeholder={t.ui.profile.notePlaceholder}
        value={note}
        maxLength={LIMITS.noteMax}
        rows={4}
        onChange={(e) => setNote(e.target.value)}
      />
    </Sheet>
  );
}
