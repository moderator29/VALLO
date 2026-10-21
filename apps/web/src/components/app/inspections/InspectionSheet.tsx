"use client";

import "@/app/css/inspection.css";
import { UnsafeSheet } from "@/components/app/safety/UnsafeSheet";
import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { countOf, formatDate, formatNumber, type Dictionary, type Locale } from "@vallo/i18n/core";
import { GateHandshake } from "./GateHandshake";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { Button, ButtonLink } from "@/components/ui/Button";
import { IconPlate } from "@/components/ui/IconPlate";
import { icon3dSrc } from "@/components/ui/icon-3d";
import { panelClass } from "@/components/ui/Panel";
import { SuccessSheet } from "@/components/ui/SuccessSheet";
import { successCopy, type SuccessWords } from "@/lib/ui/success-moments";
import { MediaFrame } from "@/components/app/MediaFrame";
import { formatPhone } from "@/lib/phone";
import { BackControl } from "@/components/ui/BackControl";
import type { ListingKind } from "@/lib/listings/types";
import {
  acceptProposedTime,
  answerInspection,
  addReportPhoto,
  closeInspection,
  createInspectionPhotoUpload,
  saveInspectionReport,
} from "@/lib/inspections/actions";
import { loadBrowserClient } from "@/lib/supabase/load-client";
import { reencodeToJpeg } from "@/components/social/profile/reencode";
import {
  EMPTY_REPORT,
  ROOM_COPY,
  ROOM_ITEMS,
  canEditReport,
  canSubmit,
  checkedCount,
  fromSaved,
  photosShort,
  type InspectionReport,
  type RoomItem,
} from "@/lib/inspections/report";
import {
  INSPECTION_OUTCOMES,
  NO_SHOW_DISPUTE_MS,
  type NoShow,
  waitingOn,
  type Inspection,
  type InspectionOutcome,
  type InspectionState,
} from "@/lib/inspections/types";
import { StatusTrack } from "@/components/app/status/StatusTrack";
import { viewingTrack } from "@/components/app/status/tracks";
import { statusFor, type BadgeTone } from "./status";
import { TierBadge } from "@/components/trust/TierBadge";
import { TruthQuestions } from "./TruthQuestions";
import { DrawUpAgreement } from "@/components/app/agreements/DrawUpAgreement";
import { AGREEMENT_STATUS_LABEL } from "@/components/app/agreements/status";
import { NO_INSPECTION_FEE, PRIVATE_FEE_NOTE, NO_INSPECTION_FEE_HEADLINE } from "@/lib/money/copy";
import { ViewingDayKit } from "./ViewingDayKit";
import { ViewingStepSheet, ViewingTimeSheet, type StepResult } from "./ViewingSheets";
import { viewingWords } from "./viewing-words";
import { disputeNoShow, reportNoShow } from "@/lib/inspections/no-show-actions";

/**
 * ONE INSPECTION, EXACTLY IN THE ANATOMY OF F6A8A482 / founder/inspection-target.jpg.
 *
 * The listing card with its badge, the date / party / status row, the
 * inspection's lifecycle, the eight-room checklist with its count and bar,
 * the notes field, the outcome choice, Add Photos (lit) and Submit
 * Inspection Report (glass, disabled until it can be sent). Containers,
 * plates and buttons are the shared layer (Panel, IconPlate, Button).
 *
 * THE REPORT (eight rooms and notes) writes through
 * `saveInspectionReport` and nothing of this surface's own; photos go through
 * `addReportPhoto`. Behind ONE flag
 * (`reportLive`, `lib/inspections/report-flag.ts`). A tick is drawn only from
 * what the action read back from the database, never optimistically. With
 * the flag off the rows draw, the circles are not pressable, and a plain line
 * says so. The lifecycle above it writes through the existing actions.
 */

export type InspectionListingFacts = {
  area: string;
  city: string;
  kind: ListingKind;
  kindLabel: string;
  /** Pre-formatted through formatMoney; empty when nothing is stated. */
  priceLabel: string;
  periodLabel: string;
  photo: string | null;
  hue: number;
  /**
   * The listing is one of the catalogue's examples (`listings.is_demo`).
   * Optional because fixtures predate it. Drawn as its own badge so an
   * example can never pass as a real property someone is going to see.
   */
  isDemo?: boolean;
  /**
   * The listing is let (`listing_intent = 'rent'`). Only then is an agreement
   * drawn up from the report, and only then does the report need photos.
   */
  isRental?: boolean;
};

const STATE_TONE: Record<InspectionState, BadgeTone> = {
  REQUESTED: "pending",
  CONFIRMED: "good",
  PROPOSED: "pending",
  DECLINED: "bad",
  COMPLETED: "good",
  WITHDRAWN: "quiet",
  NO_SHOW: "bad",
};

const CROPS = "/brand/session-b/inspection";

/** A crop from the render (SOURCES.md), dark only. */
function Crop({ name, width, height, className }: { name: string; width: number; height: number; className?: string }) {
  return (
    <Image
      src={`${CROPS}/${name}.webp`}
      alt=""
      width={width}
      height={height}
      unoptimized
      className={`nf-ix-crop ${className ?? ""}`}
    />
  );
}

function whenLine(value: string, locale: Locale): { day: string; time: string } {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { day: "", time: "" };
  return {
    day: formatDate(date, locale, { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" }),
    time: formatDate(date, locale, { hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" }),
  };
}

function Badge({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
  return <span className={`nf-ix-badge nf-ix-badge--${tone}`}>{children}</span>;
}

export function InspectionSheet({
  viewingCopy,
  flowCopy,
  inspection,
  side,
  facts,
  locale,
  open = false,
  report = null,
  reportLive = false,
  quoteLine = null,
  truth = null,
  tenancyReview = null,
  unsafe = null,
  gateCopy,
  needPhotos = 0,
  agreement = null,
  success,
  dayKit,
  now,
  noShow = null,
}: {
  /** The no-show record, on a NO_SHOW inspection this reader is a party to. */
  noShow?: NoShow | null;
  /** B5: the viewing day kit's words. Absent, no kit. */
  dayKit?: Dictionary["memberKit"]["dayKit"];
  /** The render's clock, so a preview or a test can pin "before" and "after" the viewing. */
  now?: number;
  /** The page's `t.success`, for "report submitted" and "recorded". Absent, no sheet. */
  success?: SuccessWords;
  inspection: Inspection;
  side: "lister" | "requester";
  facts: InspectionListingFacts | null;
  locale: Locale;
  /** Expanded on arrival. The first live one is; the rest fold to their card. */
  open?: boolean;
  /** The saved report (I1), or null when none exists or storage is off. */
  report?: InspectionReport | null;
  /** The one flag: report storage exists. */
  reportLive?: boolean;
  /** V-13: "Quoted at ₦3,900,000 on Thu 1 Oct", once the lister's yes froze it. */
  quoteLine?: string | null;
  /**
   * V-05: the four truth questions, when the page decided they are open for
   * this viewer (the requester, after the agreed time). Null draws nothing.
   */
  truth?: { answeredAt: string | null; copy: Dictionary["trustVisible"]["truth"] } | null;
  /** V-59: the tenancy review, when one is waiting for this renter. */
  tenancyReview?: { href: string; label: string } | null;
  /** V-63: "I feel unsafe", on an inspection that is still ahead or under way. */
  unsafe?: Dictionary["trustVisible"]["unsafe"] | null;
  /** V-35: the gate handshake's copy. Absent, no gate section is drawn. */
  gateCopy?: Dictionary["platform"]["gate"];
  /**
   * `money_policy.min_inspection_photos`. Applied only to a rental, whose
   * report the agreement is drawn up from; the database holds the same rule.
   */
  needPhotos?: number;
  /** The agreement already drawn up from this inspection, when there is one. */
  agreement?: { id: string; status: string } | null;
  /** The moves' words (`threads.rental`), from the server parent. */
  viewingCopy: Dictionary["threads"]["rental"];
  /** The card's own words (`memberFlows.inspection`), from the server parent. */
  flowCopy: Dictionary["memberFlows"]["inspection"];
}) {
  const {
    VIEWING_WORDS,
    PROPOSE_WORDS,
    RESCHEDULE_WORDS,
    DECLINE_WORDS,
    LISTER_CANCEL_WORDS,
    WITHDRAW_WORDS,
    noShowWords,
    DISPUTE_WORDS,
    NO_SHOW_WORDS,
    RENTER_CANCEL_WORDS,
  } = viewingWords(viewingCopy);
  const w = flowCopy;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  /* The one sheet open over the card, if any: a time to offer, or a final
     move asked before it is made. */
  const [sheet, setSheet] = useState<
    null | "propose" | "reschedule" | "decline" | "cancelLister" | "withdraw" | "cancelRenter" | "noShow" | "dispute"
  >(null);
  /* A second tap while the first is in flight is dropped, not sent twice. */
  const inFlight = useRef(false);
  /* Read once, when the card mounts, as the day kit does: whether the agreed
     time is still ahead decides what can be moved and what can be recorded. */
  const [clock] = useState(() => now ?? Date.now());
  /* V-35: whether the card is open, so the gate section mounts only then. */
  const [expanded, setExpanded] = useState(open);
  const [outcome, setOutcome] = useState<InspectionOutcome | null>(null);
  const [saved, setSaved] = useState<InspectionReport>(report ?? EMPTY_REPORT);
  const [notes, setNotes] = useState(report?.notes ?? "");
  /* The report was submitted, or the inspection closed with its outcome.
     Opened only from the action's own ok, never from a draft save. */
  const [done, setDone] = useState<"inspectionReportSubmitted" | "inspectionRecorded" | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const waiting = waitingOn(inspection.state);
  const yourMove = waiting === side;
  const shown = inspection.slotAt ?? inspection.requestedAt;
  const when = whenLine(shown, locale);
  const status = statusFor(inspection, side);
  const editable = canEditReport(reportLive, inspection.state, saved);
  const rooms = checkedCount(saved.items);
  const isRental = facts?.isRental === true;
  const photoNeed = isRental ? needPhotos : 0;
  /* The agreed time has come: only then can a viewing be recorded as done
     (the server holds the same rule), and until then a booked one can still
     be moved or called off. */
  const timeCome = Date.parse(shown) <= clock;
  /* Declined or withdrawn: nobody went, so there is no report to open. */
  const noViewing =
    inspection.state === "DECLINED" || inspection.state === "WITHDRAWN" || inspection.state === "NO_SHOW";
  /* The party marked absent may dispute, once, within 48 hours. */
  const mayDispute =
    inspection.state === "NO_SHOW" &&
    noShow !== null &&
    !noShow.reportedByMe &&
    noShow.disputedAt === null &&
    clock <= Date.parse(noShow.reportedAt) + NO_SHOW_DISPUTE_MS;
  const submittable = canSubmit(reportLive, inspection.state, saved, outcome, photoNeed) && timeCome;
  const photosMissing = photosShort(saved, photoNeed);

  function run(work: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    startTransition(async () => {
      try {
        const result = await work();
        if (!result.ok) {
          setError(result.error ?? w.failed);
          return;
        }
        after?.();
        router.refresh();
      } finally {
        inFlight.current = false;
      }
    });
  }

  /* A move made from a sheet: the sheet draws the refusal itself, and on
     success the card re-reads. */
  function settle(result: StepResult): StepResult {
    if (result.ok) startTransition(() => router.refresh());
    return result;
  }
  const answerWith = (state: "PROPOSED" | "DECLINED", when: string | null, note: string) =>
    answerInspection({
      id: inspection.id,
      state,
      ...(when ? { when } : {}),
      ...(note ? { note } : {}),
    }).then(settle);
  const withdraw = () => closeInspection({ id: inspection.id, state: "WITHDRAWN" }).then(settle);

  /*
   * A tick is drawn only from what the action read back, never
   * optimistically. The notes travel with EVERY call: the action writes
   * `notes ?? null` on each save, so a tick sent without them would clear
   * what was typed.
   */
  function saveReport(body: { items?: { item: RoomItem; checked: boolean }[]; submit?: boolean }) {
    setError(null);
    startTransition(async () => {
      const result = await saveInspectionReport({
        inspectionId: inspection.id,
        items: body.items ?? [],
        notes: notes.trim().length > 0 ? notes : null,
        submit: body.submit ?? false,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved((now) => fromSaved(result.data, now.photoCount));
      if (body.submit === true) setDone("inspectionReportSubmitted");
      router.refresh();
    });
  }

  /*
   * A photo into the report: a signed path from
   * `createInspectionPhotoUpload`, the upload straight from the browser to the
   * private bucket, then `addReportPhoto` records the row.
   * The count moves only when that row came back.
   */
  async function addPhoto(picked: File) {
    setError(null);
    setUploading(true);
    try {
      /*
       * The original photo never leaves the phone: a camera photo carries
       * EXIF, usually with GPS, so it is re-encoded through a canvas first
       * (pixels only, the rule the thread, support and listing photos follow).
       * The server scrubs again before recording it. A PDF is a document and
       * goes as it is. A photo this browser cannot decode (HEIC outside
       * Safari) is refused in words, never sent as the original.
       */
      const isPdf = picked.type === "application/pdf" || picked.name.toLowerCase().endsWith(".pdf");
      let file: Blob = picked;
      let extension = "pdf";
      let contentType = "application/pdf";
      if (!isPdf) {
        const clean = await reencodeToJpeg(picked, { maxEdge: 2560, quality: 0.9 });
        if (!clean) {
          setError("That photo could not be read on this device. Try a JPEG or a screenshot.");
          return;
        }
        file = clean;
        extension = "jpg";
        contentType = "image/jpeg";
      }
      const target = await createInspectionPhotoUpload({ inspectionId: inspection.id, extension });
      if (!target.ok) {
        setError(target.error);
        return;
      }
      const client = await loadBrowserClient();
      if (!client) {
        setError(w.photoFailed);
        return;
      }
      const upload = await client
        .storage.from("inspection-photos")
        .uploadToSignedUrl(target.data.path, target.data.token, file, { contentType });
      if (upload.error) {
        setError(w.photoFailed);
        return;
      }
      const added = await addReportPhoto({ inspectionId: inspection.id, storagePath: target.data.path });
      if (!added.ok) {
        setError(added.error);
        return;
      }
      setSaved((now) => ({ ...now, photoCount: now.photoCount + 1 }));
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  function submit() {
    if (reportLive) {
      saveReport({ submit: true });
      return;
    }
    if (!outcome) return;
    run(
      () => closeInspection({ id: inspection.id, state: "COMPLETED", outcome }),
      () => setDone("inspectionRecorded"),
    );
  }
  const doneWords = done && success ? successCopy(success, done) : null;

  return (
    <>
    <details
      className="nf-ix nf-ix-fold"
      open={open}
      onToggle={(event) => setExpanded((event.currentTarget as HTMLDetailsElement).open)}
      data-testid="inspection-sheet"
    >
      <summary>
        <div className={panelClass({ variant: "card", className: "nf-ix-card" })}>
          <div className="nf-ix-card__photo" aria-hidden="true">
            <MediaFrame hue={facts?.hue ?? 0} kind={facts?.kind ?? "home"} ghost={Boolean(facts?.photo)} />
            {facts?.photo && <Image src={facts.photo} alt="" fill sizes="(min-width: 640px) 160px, 116px" className="object-cover" />}
          </div>
          <div className="nf-ix-card__text">
            <span className="nf-ix-card__badges">
              <Badge tone={STATE_TONE[inspection.state]}>{w.state[inspection.state]}</Badge>
              {facts?.isDemo && <Badge tone="quiet">{w.example}</Badge>}
            </span>
            <p className="nf-ix-card__title">{inspection.listingTitle ?? w.gone}</p>
            {facts && (facts.area || facts.city) && (
              <p className="nf-ix-card__line">
                <UiIcon name="location" size={12} />
                <span className="truncate">{[facts.area, facts.city].filter(Boolean).join(", ")}</span>
              </p>
            )}
            {facts && (
              <p className="nf-ix-card__line">
                <UiIcon name="house" size={12} />
                <span className="truncate">{facts.kindLabel}</span>
              </p>
            )}
            {facts?.priceLabel && (
              <p className="nf-ix-card__price">
                {facts.priceLabel} {facts.periodLabel && <small>{facts.periodLabel}</small>}
              </p>
            )}
            {quoteLine && (
              <p className="nf-ix-card__line" data-testid="inspection-quote">
                <UiIcon name="key" size={12} />
                <span className="truncate">{quoteLine}</span>
              </p>
            )}
          </div>
          <UiIcon name="chevron-right" size={20} className="nf-ix-card__chev" />
        </div>
        {/* Track B: visible on the closed card too, so nobody has to open it
            to learn there is nothing to pay. */}
        <p className="nf-ix-nofee-line" data-testid="inspection-no-fee-headline">
          {NO_INSPECTION_FEE_HEADLINE}
        </p>
      </summary>

      {/* TRACK B: stated on the inspection screen itself, not only in a policy. */}
      <div className="nf-ix-nofee" role="note" data-testid="inspection-no-fee">
        <UiIcon name="verified" size={16} />
        <p>
          <strong>{NO_INSPECTION_FEE_HEADLINE}.</strong> {NO_INSPECTION_FEE} {PRIVATE_FEE_NOTE}
        </p>
      </div>

      <div className="nf-ix-body">
        {/* ---------------------------------------------- date, party, state */}
        {/* Three label-and-value cells, not a definition list: each cell carries
            its glyph beside the words, and a dl may hold only dt and dd in its
            groups (axe definition-list and dlitem, 9 findings on the agent's
            inspections at 390, C1 sweep). The words read in the same order. */}
        <div className={panelClass({ variant: "card", className: "nf-ix-facts" })}>
          <div className="nf-ix-fact">
            <span className="nf-ix-fact__glyph" aria-hidden="true">
              <Crop name="glyph-calendar" width={44} height={44} />
            </span>
            <div className="nf-ix-fact__text">
              <p className="nf-ix-fact__label">{w.date}</p>
              <p className="nf-ix-fact__value">{when.day}</p>
              {/* The hour somebody has to be at the gate, said on whose
                  clock: a renter reading this abroad sees Lagos time, as the
                  picker that set it said. */}
              <p className="nf-ix-fact__sub">
                {when.time}
                {when.time && <span className="nf-ix-fact__zone">{VIEWING_WORDS.lagosTime}</span>}
              </p>
            </div>
          </div>
          <div className="nf-ix-fact">
            <span className="nf-ix-fact__glyph" aria-hidden="true">
              <Crop name="glyph-person" width={46} height={46} />
            </span>
            <div className="nf-ix-fact__text">
              {/* The render says "Assigned Agent". The data model has no
                  assigned agent: `inspection_requests` names the requester
                  and the lister (owner or agent) and nobody else, so the
                  label says what the row holds (CLAIMS_RULE; ledger 9). */}
              <p className="nf-ix-fact__label">{side === "requester" ? w.listedBy : w.requestedBy}</p>
              <p className="nf-ix-fact__value">
                {inspection.counterpartName ?? w.notNamed}
                {inspection.counterpartBadge ? <TierBadge tier={inspection.counterpartBadge} size={14} className="nf-ix-name-tier" /> : null}
              </p>
              {/* The number, visible under the name and itself the tel: link,
                  when `lib/security/counterpart-contact.ts` hands one over. */}
              {inspection.counterpartPhone && (
                <p>
                  <a
                    href={`tel:${inspection.counterpartPhone}`}
                    className="nf-ix-fact__phone nf-numeric"
                    aria-label={w.call
                      .replace("{name}", inspection.counterpartName ?? w.them)
                      .replace("{phone}", formatPhone(inspection.counterpartPhone))}
                    data-testid="inspection-call"
                  >
                    {formatPhone(inspection.counterpartPhone)}
                  </a>
                </p>
              )}
            </div>
          </div>
          <div className="nf-ix-fact">
            <span className="nf-ix-fact__glyph" aria-hidden="true">
              <Crop name="glyph-clock" width={46} height={44} />
            </span>
            <div className="nf-ix-fact__text">
              <p className="nf-ix-fact__label">{w.status}</p>
              <p className="nf-ix-fact__badge">
                <Badge tone={status.tone}>{status.label}</Badge>
              </p>
            </div>
          </div>
        </div>

        {/* -------------------------------------------------------- lifecycle */}
        {/* The shared status track (spec section 14): the four rungs the
            record can honestly say happened, dated from the request's own
            times; a decline or a withdrawal stops it where it stood. */}
        <StatusTrack
          label={w.progress}
          testId="inspection-track"
          steps={viewingTrack({
            state: inspection.state,
            outcome: inspection.outcome ?? null,
            createdAt: inspection.createdAt,
            respondedAt: inspection.respondedAt,
            slotAt: inspection.slotAt,
          }).map((step) => {
            const at = step.at ? whenLine(step.at, locale) : null;
            return {
              key: step.key,
              label:
                step.state === "failed"
                  ? inspection.state === "DECLINED"
                    ? w.state.DECLINED
                    : inspection.state === "NO_SHOW"
                      ? NO_SHOW_WORDS.badge
                      : w.state.WITHDRAWN
                  : w.rung[step.key],
              when: at && at.day ? `${at.day}, ${at.time}` : null,
              state: step.state,
            };
          })}
        />

        {/* ------------------------------------------ V-59, the tenancy review */}
        {tenancyReview && (
          <ButtonLink href={tenancyReview.href} variant="primary" full data-testid="tenancy-review-entry">
            {tenancyReview.label}
          </ButtonLink>
        )}

        {/* V-63: one control, whichever side of the viewing this person is. */}
        {unsafe && <UnsafeSheet copy={unsafe} inspectionId={inspection.id} trigger="button" filerIsLister={side === "lister"} />}

        {/* ------------------------------------------ V-05, the truth questions */}
        {truth && (
          <TruthQuestions
            inspectionId={inspection.id}
            answeredAt={truth.answeredAt}
            copy={truth.copy}
            locale={locale}
          />
        )}

        {/* -------------------------------------------------------- checklist */}
        {/* Not drawn on a request that was declined or withdrawn: nobody went,
            and eight rooms that can never be ticked are a form with no use. */}
        {!noViewing && (
        <section className={panelClass({ className: "nf-ix-check" })} aria-label={w.checklist}>
          <div className="nf-ix-check__head">
            <p className="nf-ix-check__title">
              <Crop name="glyph-list" width={34} height={34} className="nf-ix-check__glyph" />
              {w.checklist}
            </p>
            <div className="nf-ix-check__count">
              <span className="nf-numeric">
                {w.roomsDone
                  .replace("{done}", formatNumber(rooms.done, locale))
                  .replace("{total}", formatNumber(rooms.total, locale))}
              </span>
              <span
                className="nf-ix-bar"
                role="progressbar"
                aria-label={w.roomsChecked}
                aria-valuemin={0}
                aria-valuemax={rooms.total}
                aria-valuenow={rooms.done}
              >
                <span style={{ width: `${(rooms.done / rooms.total) * 100}%` }} />
              </span>
            </div>
          </div>
          {!reportLive && (
            <p className="nf-ix-check__note" data-testid="inspection-report-off">
              {w.reportOff}
            </p>
          )}
          <ul className="nf-ix-check__rows">
            {ROOM_ITEMS.map((item) => {
              const checked = saved.items[item] === true;
              const copy = ROOM_COPY[item];
              return (
                <li key={item} className={`nf-ix-room${checked ? " nf-ix-room--done" : ""}`}>
                  <IconPlate size="sm" className="nf-ix-room__plate">
                    <Crop name={`room-${item}`} width={50} height={50} />
                  </IconPlate>
                  <span className="nf-ix-room__text">
                    <span className="nf-ix-room__name">{copy.title}</span>
                    <span className="nf-ix-room__detail">{copy.detail}</span>
                  </span>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    aria-label={w.roomChecked.replace("{room}", copy.title)}
                    className="nf-ix-room__check"
                    disabled={!editable || pending}
                    onClick={() => saveReport({ items: [{ item, checked: !checked }] })}
                    data-testid={`inspection-room-${item}`}
                  />
                </li>
              );
            })}
          </ul>
        </section>
        )}

        {/* ------------------------------------------------------------ notes */}
        {/* On a closed request it carries only what each side wrote, and is
            not drawn when neither wrote anything. */}
        {(!noViewing || inspection.note || inspection.listerNote) && (
        <section className={panelClass({ className: "nf-ix-notes" })} aria-label={w.notes}>
          <span className="nf-ix-notes__glyph" aria-hidden="true">
            <Crop name="glyph-pencil" width={38} height={38} />
          </span>
          <div className="min-w-0 flex-1">
            {noViewing ? (
              <p className="nf-ix-notes__label">{w.notes}</p>
            ) : (
              <label className="nf-ix-notes__label" htmlFor={`notes-${inspection.id}`}>
                {w.notes}
              </label>
            )}
            {inspection.note && (
              <p className="nf-ix-notes__said">
                <span className="nf-ix-notes__who">{side === "requester" ? w.youWrote : w.theyWrote}</span>
                {inspection.note}
              </p>
            )}
            {inspection.listerNote && (
              <p className="nf-ix-notes__said">
                <span className="nf-ix-notes__who">{side === "lister" ? w.youWrote : w.listerWrote}</span>
                {inspection.listerNote}
              </p>
            )}
            {!noViewing && (
              <textarea
                id={`notes-${inspection.id}`}
                className="nf-ix-notes__field"
                rows={1}
                maxLength={2000}
                placeholder={w.notesPlaceholder}
                value={notes}
                disabled={!editable || pending}
                onChange={(event) => setNotes(event.target.value)}
                onBlur={() => {
                  if (editable && notes !== (saved.notes ?? "")) saveReport({});
                }}
                data-testid="inspection-notes"
              />
            )}
          </div>
        </section>
        )}

        {/* The outcome is recorded by the close action, so it is drawn only
            while report storage is off; with it on, submitting the report
            is what closes the inspection and I1 has no outcome to carry it
            (request I1a). Drawn and dropped would be worse than not drawn. */}
        {/* V-35: the gate code, which works with no signal on either phone. */}
        {/* Mounted only while this card is open: a closed card asks for no
            seed, writes no pack and runs no clock (review finding 6). */}
        {/* B5: add to calendar, and on the day "On my way" and "Running late". */}
        {inspection.state === "CONFIRMED" && dayKit && (
          <ViewingDayKit
            inspectionId={inspection.id}
            slotAt={inspection.slotAt}
            area={facts?.area || facts?.city || ""}
            place={[facts?.area, facts?.city].filter(Boolean).join(", ")}
            conversationId={inspection.conversationId}
            copy={dayKit}
          />
        )}

        {inspection.state === "CONFIRMED" && gateCopy && expanded && (
          <GateHandshake inspectionId={inspection.id} locale={locale} copy={gateCopy} />
        )}

        {/* Asked only once the agreed time has come: before it there is
            nothing to say about how it went, and the server refuses it. */}
        {inspection.state === "CONFIRMED" && !reportLive && timeCome && (
          <section className={panelClass({ className: "nf-ix-outcome" })} aria-label={w.howItWent}>
            <p className="nf-ix-outcome__head" id={`outcome-${inspection.id}`}>
              {w.howItWent}
            </p>
            <div className="nf-ix-outcome__options" role="radiogroup" aria-labelledby={`outcome-${inspection.id}`}>
              {INSPECTION_OUTCOMES.map((value) => {
                const chosen = outcome === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={chosen}
                    aria-label={w.outcome[value]}
                    className="nf-ix-option"
                    onClick={() => setOutcome(value)}
                    data-testid={`inspection-outcome-${value}`}
                  >
                    <span className="nf-ix-option__ring" aria-hidden="true" />
                    {w.outcomeShort[value]}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {error && (
          <p role="alert" className="nf-ix-error">
            {error}
          </p>
        )}

        {/* ---------------------------------------------------------- actions */}
        <div className="nf-ix-actions">
          {/* Decline and Withdraw have no way back in the database, so each
              asks first (the thread always did); a decline can carry the one
              line the renter's notification shows. */}
          {yourMove && side === "lister" && (
            <div className="nf-ix-actions__row">
              <Button
                variant="primary"
                disabled={pending}
                onClick={() => run(() => answerInspection({ id: inspection.id, state: "CONFIRMED" }))}
                data-testid="inspection-confirm"
              >
                {VIEWING_WORDS.confirm}
              </Button>
              <Button variant="secondary" disabled={pending} onClick={() => setSheet("propose")}>
                {VIEWING_WORDS.offerAnother}
              </Button>
              <Button variant="quiet" disabled={pending} onClick={() => setSheet("decline")} data-testid="inspection-decline">
                {VIEWING_WORDS.decline}
              </Button>
            </div>
          )}
          {yourMove && side === "requester" && inspection.state === "PROPOSED" && (
            <div className="nf-ix-actions__row">
              <Button
                variant="primary"
                disabled={pending}
                onClick={() => run(() => acceptProposedTime({ id: inspection.id }))}
                data-testid="inspection-accept-time"
              >
                {VIEWING_WORDS.acceptTime}
              </Button>
              <Button variant="quiet" disabled={pending} onClick={() => setSheet("withdraw")} data-testid="inspection-withdraw">
                {VIEWING_WORDS.withdraw}
              </Button>
            </div>
          )}
          {side === "requester" && inspection.state === "REQUESTED" && (
            <div className="nf-ix-actions__row">
              <Button variant="quiet" disabled={pending} onClick={() => setSheet("withdraw")} data-testid="inspection-withdraw">
                {VIEWING_WORDS.withdraw}
              </Button>
            </div>
          )}

          {/* A request nobody went to: say so, and for the renter, the way to
              ask again, instead of a report that can never open. */}
          {noViewing && (
            <>
              <p className="nf-ix-hint" data-testid="inspection-closed-line">
                {inspection.state === "NO_SHOW"
                  ? noShowLine(noShow, side, w.noShow)
                  : inspection.state === "DECLINED"
                  ? side === "requester"
                    ? w.listerDeclined
                    : w.youDeclined
                  : side === "requester"
                    ? w.youWithdrew
                    : w.theyWithdrew}
              </p>
              {mayDispute && (
                <Button variant="secondary" full disabled={pending} onClick={() => setSheet("dispute")} data-testid="inspection-dispute">
                  {NO_SHOW_WORDS.dispute}
                </Button>
              )}
              {side === "requester" && inspection.state !== "NO_SHOW" && (
                <ButtonLink href={`/listing/${inspection.listingId}`} variant="secondary" full>
                  {w.askAgain}
                </ButtonLink>
              )}
            </>
          )}

          {!noViewing && (
          <>
          {/*
            Add Photos, as the render draws it (the render's own camera). With
            the report on it uploads into the report through the report photo
            actions; with it off it opens the conversation, the one photo path
            an inspection then has.
          */}
          {reportLive ? (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                className="sr-only"
                tabIndex={-1}
                /* Out of the tab order (the button below opens it), and still
                   named for a screen reader's form list (axe label, C1 sweep). */
                aria-label={w.addPhotoLabel}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void addPhoto(file);
                }}
              />
              {/* Lit only once the report is open. Before a time is agreed the
                  screen's one primary is the agreement (Confirm), and two lit
                  buttons on one phone screen is two glows (north star 12,
                  point 1; C1 sweep on the agent's inspections). */}
              <Button
                variant={editable ? "primary" : "secondary"}
                full
                className="nf-ix-cta"
                disabled={!editable || uploading || pending}
                onClick={() => fileRef.current?.click()}
                data-testid="inspection-add-photos"
              >
                <Crop name="glyph-camera" width={38} height={34} className="nf-ix-cta__glyph" />
                {uploading
                  ? w.addingPhoto
                  : saved.photoCount > 0
                    ? w.addPhotosCount.replace("{count}", formatNumber(saved.photoCount, locale))
                    : w.addPhotos}
                <UiIcon name="chevron-right" size={16} className="nf-ix-cta__end" />
              </Button>
            </>
          ) : inspection.conversationId ? (
            <Link
              href={`/messages/${inspection.conversationId}?attach=1`}
              className="nf-btn nf-btn--primary nf-btn--md nf-btn--full nf-ix-cta"
              aria-label={w.addPhotosInChat}
              data-testid="inspection-add-photos"
            >
              <Crop name="glyph-camera" width={38} height={34} className="nf-ix-cta__glyph" />
              {w.addPhotos}
              <UiIcon name="chevron-right" size={16} className="nf-ix-cta__end" />
            </Link>
          ) : null}

          <Button
            variant="secondary"
            full
            className="nf-ix-submit"
            disabled={!submittable || pending}
            onClick={submit}
            data-testid="inspection-submit"
          >
            <Crop name="glyph-plane" width={36} height={36} className="nf-ix-cta__glyph" />
            {w.submit}
          </Button>
          {/* The render draws no helper line: with the report on, the count
              ("n of 8 done") already says why Submit waits. These carry
              states the render cannot show (report storage off, a viewing
              whose time has not come, and an inspection not yet agreed), so
              they stay; ledger 9, S12. */}
          {inspection.state === "CONFIRMED" && !timeCome && (
            <p className="nf-ix-hint" data-testid="inspection-report-waits">
              {reportLive
                ? w.waitsReport
                : w.waitsOutcome}
            </p>
          )}
          {!reportLive && inspection.state === "CONFIRMED" && timeCome && !submittable && (
            <p className="nf-ix-hint">{w.chooseOutcome}</p>
          )}
          {(inspection.state === "REQUESTED" || inspection.state === "PROPOSED") && (
            <p className="nf-ix-hint">{w.opensWhenAgreed}</p>
          )}

          {/* Once the time has come, either side can say the other did not
              come. The other side is told and can dispute it for 48 hours. */}
          {inspection.state === "CONFIRMED" && timeCome && (
            <div className="nf-ix-actions__row nf-ix-actions__row--change">
              <Button
                variant="quiet"
                size="sm"
                disabled={pending}
                onClick={() => setSheet("noShow")}
                data-testid="inspection-no-show"
              >
                {side === "lister" ? NO_SHOW_WORDS.markRenter : NO_SHOW_WORDS.markLister}
              </Button>
            </div>
          )}

          {/* A booked viewing that is still ahead can be moved or called off.
              The database always allowed both (the lister to PROPOSED or
              DECLINED, the renter to WITHDRAWN); no screen offered them, so a
              confirmed viewing nobody could keep had no way out but a chat. */}
          {inspection.state === "CONFIRMED" && !timeCome && (
            <div className="nf-ix-actions__row nf-ix-actions__row--change" data-testid="inspection-change">
              {side === "lister" && (
                <Button variant="secondary" size="sm" disabled={pending} onClick={() => setSheet("reschedule")}>
                  {VIEWING_WORDS.offerAnother}
                </Button>
              )}
              <Button
                variant="quiet"
                size="sm"
                disabled={pending}
                onClick={() => setSheet(side === "lister" ? "cancelLister" : "cancelRenter")}
                data-testid="inspection-cancel"
              >
                {VIEWING_WORDS.cancelViewing}
              </Button>
            </div>
          )}
          {/* A submitted report takes no more photos, and the agreement needs
              them, so this is said while there is still time to add them. */}
          {editable && photosMissing > 0 && rooms.done === rooms.total && (
            <p className="nf-ix-hint" data-testid="inspection-photos-short">
              {w.photosShort.replace("{photos}", countOf(photosMissing, "photos", locale))}
            </p>
          )}
          {/* TRACK A: the agreement is drawn up from the renter's submitted
              report. While one is live both sides are taken to it. A
              cancelled one no longer holds the inspection
              (`agreement_open_rent_as` releases it, migration
              20260929012543), so the renter may draw up a new one from the
              same report, and both sides are told so. */}
          {agreement?.status === "cancelled" && isRental && reportLive && saved.submittedAt ? (
            <>
              <p className="nf-ix-hint" data-testid="inspection-agreement-cancelled">
                {side === "requester"
                  ? w.agreementCancelledYou
                  : w.agreementCancelledThem}{" "}
                <Link href={`/agreements/${agreement.id}`} className="underline">
                  {w.seeCancelled}
                </Link>
              </p>
              {side === "requester" && (
                <DrawUpAgreement
                  inspectionId={inspection.id}
                  minDate={new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" })}
                />
              )}
            </>
          ) : agreement ? (
            <>
              {/* The status sits under the button: `.nf-btn` does not wrap,
                  and the longest status overflows a phone-width button. */}
              <Link
                href={`/agreements/${agreement.id}`}
                className="nf-btn nf-btn--primary nf-btn--md nf-btn--full"
                data-testid="inspection-agreement"
              >
                {w.openAgreement}
              </Link>
              <p className="nf-ix-hint">{AGREEMENT_STATUS_LABEL[agreement.status] ?? agreement.status}</p>
            </>
          ) : isRental && reportLive && saved.submittedAt ? (
            side === "requester" ? (
              <DrawUpAgreement
                inspectionId={inspection.id}
                minDate={new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" })}
              />
            ) : (
              <p className="nf-ix-hint" data-testid="inspection-agreement-waiting">
                {w.renterDrawsUp}
              </p>
            )
          ) : null}
          </>
          )}
        </div>
      </div>

      {(sheet === "propose" || sheet === "reschedule") && (
        <ViewingTimeSheet
          open
          onOpenChange={(next) => setSheet(next ? sheet : null)}
          words={sheet === "reschedule" ? RESCHEDULE_WORDS : PROPOSE_WORDS}
          onSubmit={(when, note) => answerWith("PROPOSED", when, note)}
        />
      )}
      {(sheet === "decline" || sheet === "cancelLister") && (
        <ViewingStepSheet
          open
          onOpenChange={(next) => setSheet(next ? sheet : null)}
          words={sheet === "decline" ? DECLINE_WORDS : LISTER_CANCEL_WORDS}
          onConfirm={(note) => answerWith("DECLINED", null, note)}
        />
      )}
      {sheet === "noShow" && (
        <ViewingStepSheet
          open
          onOpenChange={(next) => setSheet(next ? sheet : null)}
          words={noShowWords(side === "lister" ? "requester" : "lister")}
          onConfirm={(note) => reportNoShow({ id: inspection.id, ...(note ? { note } : {}) }).then(settle)}
        />
      )}
      {sheet === "dispute" && (
        <ViewingStepSheet
          open
          onOpenChange={(next) => setSheet(next ? sheet : null)}
          words={DISPUTE_WORDS}
          onConfirm={(note) => disputeNoShow({ id: inspection.id, ...(note ? { note } : {}) }).then(settle)}
        />
      )}
      {(sheet === "withdraw" || sheet === "cancelRenter") && (
        <ViewingStepSheet
          open
          onOpenChange={(next) => setSheet(next ? sheet : null)}
          words={sheet === "withdraw" ? WITHDRAW_WORDS : RENTER_CANCEL_WORDS}
          onConfirm={() => withdraw()}
        />
      )}
    </details>
    {doneWords && success ? (
      <SuccessSheet
        open
        onOpenChange={(next) => {
          if (!next) setDone(null);
        }}
        variant={doneWords.variant}
        haptic={doneWords.haptic}
        object={doneWords.object}
        title={doneWords.title}
        body={doneWords.body}
        details={inspection.listingTitle ? [{ label: success.detail.for, value: inspection.listingTitle }] : undefined}
        primary={{ label: success.continue }}
      />
    ) : null}
    </>
  );
}

/** Where a no-show stands, from this reader's side of it. */
function noShowLine(
  noShow: NoShow | null,
  side: "lister" | "requester",
  w: Dictionary["memberFlows"]["inspection"]["noShow"],
): string {
  if (!noShow) return w.marked;
  if (noShow.resolution === "overturned") return w.overturned;
  if (noShow.resolution === "upheld") return w.upheld;
  if (noShow.reportedByMe) {
    if (side === "lister") return noShow.disputedAt ? w.youMarkedRenterDisputed : w.youMarkedRenter;
    return noShow.disputedAt ? w.youMarkedListerDisputed : w.youMarkedLister;
  }
  return noShow.disputedAt ? w.youDisputed : w.theySay;
}

/**
 * The top every inspection page opens with: the page's own back square (the
 * logo, bell and profile in the render's top row are the shared app header,
 * not this page's), the title with its second word lit, the blue sub line,
 * and the glass house with the tick at the right.
 */
export function InspectionHero({
  title = "inspection",
  sub,
  fallback = "/home",
  back = true,
}: {
  /** The lit second word. */
  title?: string;
  sub: string;
  fallback?: string;
  /** Off where a console shell already draws its own way back. */
  back?: boolean;
}) {
  return (
    <div className="nf-ix nf-ix-hero">
      {back && (
        <BackControl fallback={fallback} className="nf-ix-back" />
      )}
      <div className="nf-ix-hero__row">
        <div className="min-w-0 flex-1">
          <h1 className="nf-ix-hero__title">
            Property <span className="nf-ix-hero__lit">{title}</span>
          </h1>
          <p className="nf-ix-hero__sub">{sub}</p>
        </div>
        {/* A solid house with its tick, never the render's glass house (the
            founder, 7 October 2026: no glass anywhere). */}
        <span className="nf-ix-hero__mark" aria-hidden="true">
          <Image src={icon3dSrc("home-verified")} alt="" width={140} height={140} unoptimized className="nf-ix-crop" />
        </span>
      </div>
    </div>
  );
}
