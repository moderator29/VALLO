"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";

import { Button, ButtonLink } from "@/components/ui/Button";
import { useScopedCopy } from "@/lib/i18n/copy-scope";
import { setRoommateListingStatus } from "@/lib/features/roommates/actions";
import type { ListingKind, ListingStatus } from "@/lib/features/roommates/model";
import { ROOMMATES_ROUTES } from "@/lib/features/roommates/model";
import type { ListingReview } from "@/lib/features/roommates/queries";
import { inReview, needsReview, reviewTimeline } from "@/lib/features/roommates/review";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { feedback } from "@/lib/ui/feedback";
import { banner } from "@/lib/ui/toast";
import { bannerWithUndo } from "@/lib/ui/undo-banner";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

import { KeyDoorArt } from "./RoommatesArt";
import "./roommates-welcome.css";

const DAY = 24 * 60 * 60 * 1000;

/**
 * THE OWNER'S STATUS BANNER AND TIMELINE for a room offer: Submitted, In
 * review, then the decision, with what our team wrote when it asks for a
 * change or declines. The approved moment is a calm celebration, once per
 * post per device (it is a convenience: blocked storage shows it again).
 * Only the owner sees this; the record comes from the owner's own rows.
 */
export function ListingReviewPanel({ id, kind, status, review, now }: { id: string; kind: ListingKind; status: ListingStatus; review?: ListingReview; now: number }) {
  const copy = useScopedCopy("roommates");
  const R = copy.review;
  const router = useRouter();
  const [pending, start] = useSafeTransition();
  const [moment, setMoment] = useState(false);
  const key = `vallo.roommates.approved.${id}`;

  useEffect(() => {
    if (status !== "live" || !review?.reviewedAt) return;
    if (now - Date.parse(review.reviewedAt) > 3 * DAY) return;
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the device's choice is read after hydration, so server and first client render agree
      if (window.localStorage.getItem(key) !== "seen") setMoment(true);
    } catch {
      /* No storage: no celebration, the status still shows. */
    }
  }, [status, review?.reviewedAt, now, key]);

  if (!needsReview(kind)) return null;
  if (status !== "draft" && status !== "live" && !inReview(status)) return null;

  const move = (to: ListingStatus, done: string, undoTo: ListingStatus | null) =>
    start(async () => {
      try {
        const r = await setRoommateListingStatus({ id, status: to as "draft" });
        if (!r.ok) {
          feedback("error");
          banner.error(r.error);
          return;
        }
        feedback("confirm");
        if (undoTo) {
          bannerWithUndo(done, {
            label: copy.area.undo,
            undone: copy.area.undone,
            undo: async () => {
              const back = await setRoommateListingStatus({ id, status: undoTo as "draft" });
              return back.ok ? { ok: true } : { ok: false, error: back.error };
            },
            onUndone: () => router.refresh(),
          });
        } else banner.success(done);
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });

  if (status === "live") {
    const L = R.status.live;
    return (
      <section className="nf-rmrv" data-tone="ok" aria-labelledby={`rmrv-${id}`} data-testid="review-live">
        {moment ? (
          <div className="nf-rmcn" style={{ minBlockSize: "auto" }} data-theme="dark" data-testid="review-approved-moment">
            <span className="nf-rmcn__confetti" aria-hidden="true">
              {Array.from({ length: 16 }, (_, i) => (
                <span key={i} className="nf-rmcn__piece" style={{ "--nf-rmcn-i": i, "--nf-rmcn-a": `${(360 / 16) * i}deg` } as CSSProperties} />
              ))}
            </span>
            <KeyDoorArt className="nf-rmcn__art" />
            <h2 className="nf-rmcn__title" style={{ fontSize: "var(--nf-text-h1)" }}>
              {R.live.title}
            </h2>
            <p className="nf-rmcn__body">{L.body}</p>
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                try {
                  window.localStorage.setItem(key, "seen");
                } catch {
                  /* Not remembered. */
                }
                setMoment(false);
              }}
            >
              {R.live.view}
            </Button>
          </div>
        ) : null}
        <h2 id={`rmrv-${id}`} className="nf-rmrv__title">
          {L.title}
        </h2>
        <p className="nf-rmrv__body">{L.body}</p>
      </section>
    );
  }

  const info = R.status[status as "draft" | "submitted" | "in_review" | "changes_requested" | "rejected"];
  const steps = reviewTimeline(status);
  const tone = status === "changes_requested" ? "act" : undefined;
  return (
    <section className="nf-rmrv" data-tone={tone} aria-labelledby={`rmrv-${id}`} data-testid={`review-${status}`}>
      <h2 id={`rmrv-${id}`} className="nf-rmrv__title">
        {info.title}
      </h2>
      <ol className="nf-rmrv__steps" aria-label={R.status.submitted.title}>
        {steps.map((s) => (
          <li key={s.key} className="nf-rmrv__step" data-state={s.state} aria-current={s.state === "now" ? "step" : undefined}>
            {R.steps[s.key]}
          </li>
        ))}
      </ol>
      <p className="nf-rmrv__body">{info.body}</p>
      {review?.note && (status === "changes_requested" || status === "rejected") ? (
        <p className="nf-rmrv__note">
          <strong>{R.reasonLabel}: </strong>
          {review.note}
        </p>
      ) : null}
      <div className="nf-rmrv__actions">
        {status === "changes_requested" ? (
          <ButtonLink href={ROOMMATES_ROUTES.editListing(id)} variant="primary" size="md" leadingIcon="pencil">
            {R.edit}
          </ButtonLink>
        ) : null}
        {status === "draft" ? (
          <ButtonLink href={ROOMMATES_ROUTES.editListing(id)} variant="primary" size="md" leadingIcon="pencil">
            {R.submit}
          </ButtonLink>
        ) : null}
        {status === "submitted" || status === "in_review" || status === "changes_requested" ? (
          <Button variant="secondary" size="md" loading={pending} onClick={() => move("draft", R.withdrawn, "submitted")}>
            {R.withdraw}
          </Button>
        ) : null}
        {status === "rejected" ? (
          <ButtonLink href={`${ROOMMATES_ROUTES.create}?kind=room_offer`} variant="secondary" size="md" leadingIcon="plus">
            {copy.welcome.create}
          </ButtonLink>
        ) : null}
      </div>
    </section>
  );
}
