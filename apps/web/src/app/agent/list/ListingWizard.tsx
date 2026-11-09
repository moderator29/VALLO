"use client";

import { PhoneGateLink } from "@/components/app/PhoneGateLink";
import { VerifyGateLink } from "@/components/app/VerifyGateLink";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate, formatMoney, type Dictionary, type Locale } from "@vallo/i18n/core";
import { fill } from "../_copy";
import { loadBrowserClient } from "@/lib/supabase/load-client";
import { canCapturePhoto, capturePhoto } from "@/lib/native/device";
import { ListerFeeGate } from "@/components/money/ListerFeeGate";
import {
  acceptanceMatches,
  feeGateHoldsSend,
  listerFeeFigures,
  type ListerFeeAcceptance,
  type ListerFeePolicy,
} from "@/lib/money/lister-fee";
import { fetchListerFeePolicy, recordListerFeeAcceptance } from "@/lib/money/lister-fee-actions";
import {
  addPhoto,
  addVideo,
  removePhoto,
  removeVideo,
  reorderMedia,
  saveDraft,
  setAmenities,
  setListingAccess,
  submitListing,
} from "@/lib/agent/listings-actions";
import type { ListingStatus, WizardDraft } from "@/lib/agent/listings-queries";
import { BROADCAST_MONEY_KEYS, type BroadcastKey, type BroadcastParse } from "@/lib/agent/broadcast";
import { PriceGuidePanel, usePriceGuide } from "./PriceGuide";
import { DraftMatches } from "./DraftMatches";
import { feeNormLine, type GuideSubject } from "@/lib/price-check/wizard-guide";
import {
  MAX_PHOTOS,
  MAX_PHOTO_BYTES,
  MAX_PHOTO_LABEL,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_LABEL,
  MAX_VIDEOS,
  MAX_VIDEO_SECONDS,
  MIN_MEDIA,
  PHOTO_MIME_TYPES,
  VIDEO_MIME_TYPES,
  rejectUpload,
  MAX_TITLE_LENGTH,
  MIN_DESCRIPTION_WORDS,
  MIN_PHOTO_WIDTH,
  MIN_TITLE_LENGTH,
  collapseSpaces,
  countWords,
  isRental,
  asksFact,
  type ListingFact,
  ratePeriodFor,
  submitRequirements,
} from "@/lib/agent/listings-model";
import { UiIcon } from "@/design-system/icons/UiIcon";
import type { ViewerCopy } from "@/components/app/messages/MediaViewer";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { canMove, mergeMedia, photoFirst } from "@/lib/listings/media-order";
import {
  looksLikeVideo,
  posterFrame,
  scrubVideoLocation,
  videoDuration,
  videoExtension,
  videoMime,
} from "@/lib/agent/video-prep";
import { uploadToStorage } from "@/lib/media/upload";
import { forgetUploadPath, resumableUpload, stableUploadPath } from "@/lib/agent/resumable-upload";
import { SUPABASE_URL } from "@/lib/supabase/env";
import { StepFrame, type StepAction, type StepSaveState } from "@/components/ui/StepFrame";
import { ListingSentForReview } from "./ListingSentForReview";
import { PushPrompt } from "@/components/app/push/PushPrompt";
import { StatusPill, toneForStatus } from "@/components/ui/StatusPill";
import { successCopy, type SuccessWords } from "@/lib/ui/success-moments";
import { EMPTY_COMPOUND_FORM, compoundPayload } from "@/lib/listings/compound";
import { EMPTY_SERVICE_FORM, servicePayload } from "@/lib/listings/service";
import { EMPTY_UNIT_FORM, unitPayload } from "@/lib/listings/unit-shape";
import { listingDraftKey } from "@/lib/agent/listing-draft-storage";
import { useDeviceStorage } from "@/components/supply/use-device-storage";
import { looksLikeStreetAddress, STREET_IN_TITLE_WARNING } from "@/lib/listings/public-title";
import { tenantPreference } from "@/lib/safety/tenant-preference";
import { fileLine, isHeic, judgePhoto, looksLikeImage, uploadErrorText } from "@/lib/listings/photo-gate";
import { reviewerAsked } from "@/lib/agent/listings-edit-state";
import { feedback } from "@/lib/ui/feedback";
import "@/app/css/catalogue.css";
import "@/app/css/lister-publish.css";
import "./steps/listing-steps.css";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { banner } from "@/lib/ui/toast";
import {
  EMPTY,
  applyKind,
  cleared,
  kindOf,
  mediaFrom,
  moneyOf,
  startStep,
  stepOfGateField,
  stepsFor,
  untouchedUnread,
  valuesFrom,
  type ListingKind,
  type Media,
  type StepId,
  type Values,
} from "./steps/model";
import { WIZARD_WORDS } from "./steps/copy";
import type { StepCtx } from "./steps/context";
import { FromMessageMark, Note, refuse } from "./steps/parts";
import { sizeOf, stripMetadata } from "./steps/photo-prep";
import { titleFromAnswers } from "./steps/describe";
import { KindStep } from "./steps/KindStep";
import { TypeStep } from "./steps/TypeStep";
import { LocationStep } from "./steps/LocationStep";
import { RoomsStep } from "./steps/RoomsStep";
import { PlaceStep } from "./steps/PlaceStep";
import { SupplyStep } from "./steps/SupplyStep";
import { CompoundStep } from "./steps/CompoundStep";
import { AccessStep } from "./steps/AccessStep";
import { AmenitiesStep } from "./steps/AmenitiesStep";
import { PriceStep } from "./steps/PriceStep";
import { ChargesStep, type ArrivalState } from "./steps/ChargesStep";
import { TermsStep } from "./steps/TermsStep";
import { PhotosStep } from "./steps/PhotosStep";
import { DescribeStep } from "./steps/DescribeStep";
import { CheckStep, type Fix } from "./steps/CheckStep";
import { FocusKeeper } from "./steps/FocusKeeper";

/**
 * The listing wizard: ONE QUESTION PER SCREEN (P1.1, November 2026).
 *
 * It was eight long screens drawn by this one file. It is now a computed flow
 * of twelve to fifteen questions on the platform's `StepFrame` (back, the save
 * state, close, the progress bar, an eyebrow, the question, and a sticky
 * "Step N of M" with Continue), ending on "Check your listing", where every
 * answer has a Change pill and the things still to fix are listed with the
 * way to each fix. The steps are DATA (`steps/model.ts`: which steps, in what
 * order, which one owns which answer, when each applies) and each question is
 * its own component in `steps/`. This file keeps the ONE state store and
 * everything that must not be split from it: the saves (to the platform as a
 * DRAFT and to this device, always), the broadcast marks, the uploads, the
 * send and its gates.
 *
 * Photos upload straight from the browser to the listing-photos bucket under
 * `<auth uid>/<listing id>/<uuid>.<ext>`, which storage RLS restricts to the
 * agent's own folder. The first photo is the cover. Anything under 1600px on
 * its long edge is refused here, and the server enforces the count at submit,
 * so the quality gate holds from both sides.
 *
 * The submit gate stays the authority on WHICH requirements are unmet; the
 * dictionary only decides how each one reads, which is why the check page and
 * the server can never disagree.
 */

type WizardCopy = Dictionary["agentListings"];
const WW = WIZARD_WORDS;

export function ListingWizard({
  success,
  copy,
  reference,
  moveInCopy,
  compoundCopy,
  serviceCopy,
  unitCopy,
  floodCopy,
  floodOpen = false,
  feeGateBlocking = false,
  initialFeePolicy,
  remainderCopy,
  moneyMapCopy,
  locale,
  userId,
  states,
  amenities,
  initial,
  canPersist,
  verifyFirst = false,
  startAt = 0,
  broadcastCopy,
  guideCopy,
  initialUnconfirmed = [],
  shotsCopy,
  viewerCopy = null,
  demandCopy,
  /* Kept for the callers that pass it: the progress path it drew is the
     StepFrame's bar and the check page's Change pills now. */
  pathCopy: _pathCopy,
  listerCopy,
  sentFrom = null,
  arrival,
  aiConsented = false,
}: {
  /** Round 5: the publish moment's few words. Absent in older harnesses, which draw the card unlabelled. */
  listerCopy?: Dictionary["experienceLister"];
  /**
   * A listing the page found already with the review team (`?id=` of one in
   * SUBMITTED or UNDER_REVIEW): the wizard opens on its check page as the
   * chain it became when it was sent, settled, rather than a lock screen.
   */
  sentFrom?: { status: ListingStatus; submittedAt: string | null } | null;
  /** The old progress path's words (reference 7110). Accepted and unused: the frame says the save state now. */
  pathCopy?: Dictionary["experienceFeatures"]["wizard"];
  /** The page's `t.success`, for "Your listing is in review" over the chain. */
  success?: SuccessWords;
  /** V-70: the shot list's words. Without them the shot list is not drawn. */
  shotsCopy?: Dictionary["afterTheGate"]["shots"];
  /** The full-screen viewer's words. Absent, the tiles are not openable. */
  viewerCopy?: ViewerCopy | null;
  /** V-10: the saved-search count on the check page. Absent in harnesses. */
  demandCopy?: Dictionary["frontDoor"]["demand"];
  /**
   * V-09: the unconfirmed set as the server holds it for this draft
   * (`listing_broadcast_marks`), so another device starts from the truth.
   * Null when the read failed: the set is then never written from here (an
   * empty set would wipe the server's) and submit waits until it is read.
   */
  initialUnconfirmed?: readonly string[] | null;
  copy: WizardCopy;
  /** V-74: the pricing step's guide. Absent in the harnesses. */
  guideCopy?: Dictionary["frontDoor"]["guide"];
  /** V-09, "Start from your WhatsApp message". Absent in the harnesses. */
  broadcastCopy?: Dictionary["frontDoor"]["broadcast"];
  reference: Dictionary["listingReference"];
  /* The move-in slice: the breakdown is the searcher's block turned round to
     face the agent, and it has to read in exactly the same words. */
  moveInCopy: Dictionary["moveIn"];
  /** V-28: the compound's five questions. */
  compoundCopy: Dictionary["shape"]["compound"];
  /** V-68: the service charge questions. */
  serviceCopy: Dictionary["shape"]["service"];
  /** V-66: the unit shape question. */
  unitCopy: Dictionary["shape"]["unit"];
  /** V-41: the flooding question. */
  floodCopy: Dictionary["shape"]["neighbours"];
  /** V-41 is behind a fail-closed flag; the question shows only when it is on. */
  floodOpen?: boolean;
  /**
   * D60: whether Send for review waits for a recorded fee acceptance
   * (`lister_fee_gate_blocking`, read fail closed). The fee screen is drawn on
   * the check page either way; off, which is the default, nothing waits.
   */
  feeGateBlocking?: boolean;
  /** The fee rates as already read, for the harnesses that draw the check page without a server. */
  initialFeePolicy?: ListerFeePolicy | null;
  /** V-13: the sentence that refuses an unexplained remainder in the total. */
  remainderCopy?: Dictionary["afterTheGate"]["remainder"];
  /** V-46: the captions that say who each move-in line is paid to. */
  moneyMapCopy?: Dictionary["afterTheGate"]["moneyMap"];
  locale: Locale;
  userId: string | null;
  states: { code: string; name: string }[];
  amenities: { code: string; label: string }[];
  initial: WizardDraft | null;
  canPersist: boolean;
  /**
   * GRADE 1 (P0.3): the lister's identity check is not sent yet, so the check
   * page names it as a thing to fix, with the way to /verification, before
   * Send is pressed (reference R27). The server refuses either way.
   */
  verifyFirst?: boolean;
  /**
   * The step to open on: a step id, or a zero-based index into this listing's
   * steps, clamped. The preview harnesses pass it so every step can be
   * photographed; nothing in the product passes it, and the default is the
   * first step, which is what /agent/list has always done.
   */
  startAt?: number | StepId;
  /** V-57: a stay's charges at the door as the page read them (LW-04). Absent in harnesses. */
  arrival?: ArrivalState;
  /** STORE-07: whether this account already agreed to the AI disclosure. */
  aiConsented?: boolean;
}) {
  const router = useRouter();
  /* Whether the draft really lands on this device, so the save state only says what is true. */
  const deviceKeeps = useDeviceStorage() && listingDraftKey(userId) !== null;
  const [values, setValues] = useState<Values>(initial ? valuesFrom(initial) : EMPTY);
  /* A fresh draft has not answered the first question, whatever the defaults say. */
  const [kindPicked, setKindPicked] = useState<boolean>(Boolean(initial));
  const kind: ListingKind = kindOf(values);
  const steps = useMemo(() => stepsFor({ kind, propertyType: values.propertyType }), [kind, values.propertyType]);
  const [stepId, setStepId] = useState<StepId>(() => {
    const opening = stepsFor({ kind: kindOf(initial ? valuesFrom(initial) : EMPTY), propertyType: (initial ? valuesFrom(initial) : EMPTY).propertyType });
    return sentFrom ? "check" : startStep(startAt, opening);
  });
  /* The step on screen. A change of type can take a step out of the flow (a
     plot has no light and water); the nearest one still asked stands in. */
  const index = Math.max(0, steps.findIndex((s) => s.id === stepId));
  const current = steps[index] ?? steps[0]!;
  /* Which way the lister is travelling, for the slide (StepFrame `direction`),
     and whether anything has moved yet. */
  const [travel, setTravel] = useState<{ dir: "forward" | "back"; moved: boolean }>({ dir: "forward", moved: false });
  /** The step a Change or a Fix came from, while the lister is on an earlier one. */
  const [returnTo, setReturnTo] = useState<StepId | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  /* The answer groups whose saved values could not be read (review 13). */
  const unread = useMemo(() => initial?.unread ?? [], [initial]);
  /* The photos and videos, in the one order the lister arranged them. */
  const [media, setMedia] = useState<Media[]>(() => mediaFrom(initial));
  const photos = useMemo(() => media.filter((item): item is Media & { kind: "photo" } => item.kind === "photo"), [media]);
  const videos = useMemo(() => media.filter((item): item is Media & { kind: "video" } => item.kind === "video"), [media]);
  /** The video being uploaded now, for its progress line. */
  const [videoProgress, setVideoProgress] = useState<{ name: string; percent: number } | null>(null);
  /* The walkthrough upload in flight, so the lister can stop it. */
  const videoAbort = useRef<AbortController | null>(null);
  useEffect(() => () => videoAbort.current?.abort(), []);
  const [chosenAmenities, setChosenAmenities] = useState<string[]>(initial?.amenityCodes ?? []);
  const [listingId, setListingId] = useState<string | null>(initial?.id ?? null);
  /** The title was started from the answers, so the account draft could exist before the Finish step. */
  const [titleStarted, setTitleStarted] = useState(false);
  /*
   * V-09: THE FIELDS A PASTED BROADCAST FILLED, until the agent touches them.
   * A key leaves this set the moment the agent edits that field, which is
   * what "confirmed" means here. The submit gate refuses while any MONEY key
   * is still in it: a figure read from a WhatsApp message is not sent for
   * review until a person has looked at it.
   */
  const [fromMessage, setFromMessage] = useState<ReadonlySet<string>>(() => new Set(initialUnconfirmed ?? []));
  const marksUnread = initialUnconfirmed === null;

  /*
   * The unconfirmed set survives a reload, keyed by the listing it belongs to
   * (or "new" before the first save). Without this a reload would quietly
   * treat every figure read from a WhatsApp message as confirmed.
   */
  const unconfirmedKey = `vallo_broadcast_unconfirmed:${listingId ?? "new"}`;
  const [unconfirmedLoaded, setUnconfirmedLoaded] = useState<string | null>(null);
  useEffect(() => {
    if (unconfirmedLoaded === unconfirmedKey) return;
    try {
      const raw = localStorage.getItem(unconfirmedKey) ?? (listingId ? localStorage.getItem("vallo_broadcast_unconfirmed:new") : null);
      const keys = raw ? (JSON.parse(raw) as unknown) : null;
      if (Array.isArray(keys) && keys.length > 0) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring from storage, once per key
        setFromMessage((prev) => new Set([...prev, ...keys.filter((k): k is string => typeof k === "string")]));
      }
    } catch {
      /* storage unavailable */
    }
    setUnconfirmedLoaded(unconfirmedKey);
  }, [unconfirmedKey, unconfirmedLoaded, listingId]);
  useEffect(() => {
    if (unconfirmedLoaded !== unconfirmedKey) return;
    try {
      if (fromMessage.size === 0) localStorage.removeItem(unconfirmedKey);
      else localStorage.setItem(unconfirmedKey, JSON.stringify([...fromMessage]));
      if (listingId) localStorage.removeItem("vallo_broadcast_unconfirmed:new");
    } catch {
      /* storage unavailable */
    }
  }, [fromMessage, unconfirmedKey, unconfirmedLoaded, listingId]);

  const [savedAt, setSavedAt] = useState<string | null>(null);
  /** What the top bar can truly say: saving, saved on the account, kept on this device, or not saved. */
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [phoneGate, setPhoneGate] = useState(false);
  /* Grade 1 (P0.3): the identity gate on submit. */
  const [verifyGate, setVerifyGate] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [photoNotice, setPhotoNotice] = useState<string | null>(null);
  useEffect(() => { if (notice) banner.error(notice); }, [notice]);
  useEffect(() => { if (photoNotice) banner.error(photoNotice); }, [photoNotice]);
  /** One line per file the last pick refused, naming the file. */
  const [photoProblems, setPhotoProblems] = useState<string[]>([]);
  /** The files the last pick could not upload for a reason a second try can fix. */
  const [retryFiles, setRetryFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  /* STORE-04: the shell's own camera, when the running binary carries it. */
  const [nativeCamera, setNativeCamera] = useState(false);
  useEffect(() => {
    let live = true;
    void canCapturePhoto().then((able) => {
      if (live) setNativeCamera(able);
    });
    return () => {
      live = false;
    };
  }, []);
  /*
   * SENT: what the server said when it accepted the listing, and whether that
   * happened in this sitting (`now`, which is what earns the arrival motion and
   * the one medium haptic). Only ever set from the action's own ok or from the
   * page's read of the stored row, so the chain never runs ahead of the truth.
   */
  const [sent, setSent] = useState<{ status: ListingStatus; at: string | null; now: boolean } | null>(() =>
    sentFrom ? { status: sentFrom.status, at: sentFrom.submittedAt, now: false } : null,
  );
  /* D51, D60, D61: THE FEE SCREEN. The rates in force for this listing are
     read when the check page opens, and the screen is drawn above Send for
     review. `undefined` is "not read yet"; null is "could not be read", which
     the screen says in words. The acceptance is held here only while the
     blocking flag is on: with it off there is no accept to hold. */
  const [feePolicy, setFeePolicy] = useState<ListerFeePolicy | null | undefined>(initialFeePolicy);
  const [feeAcceptance, setFeeAcceptance] = useState<ListerFeeAcceptance | null>(null);
  const [pending, startTransition] = useSafeTransition();
  /** Whether the last `persist` reached the server and was accepted. */
  const lastSaveOk = useRef(true);
  /** Whether the Finish step's title refusal is currently being shown. */
  const titleGateOpen = useRef(false);
  const restored = useRef(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const money = useMemo(() => moneyOf(values), [values]);
  const { forSale, tenancy, shortStay, perHead, rentMinor, rateMinor, saleMinor, priceMinor, partsSumMinor, statedTotalMinor, moveInRemainderMinor } = money;
  const rental = isRental(values.propertyType);
  /* Only the facts this property type can have are asked (`asksFact`). */
  const asks = useCallback((fact: ListingFact) => asksFact(values.propertyType, fact), [values.propertyType]);
  const feeKind = forSale ? "sale" : tenancy ? "rent" : "stay";
  /* Void the moment the price, the rate or the terms move: an acceptance is of figures. */
  const feeAccepted = acceptanceMatches(feeAcceptance, listerFeeFigures(priceMinor, feePolicy ?? null), feePolicy ?? null);
  const feeHolds = feeGateHoldsSend(feeGateBlocking, feeAccepted);
  useEffect(() => {
    /* Sent, the fee screen is gone and its rates are not read. */
    if (stepId !== "check" || !listingId || sent) return;
    let live = true;
    void fetchListerFeePolicy(listingId)
      .catch(() => null)
      .then((policy) => {
        if (live) setFeePolicy(policy);
      });
    return () => {
      live = false;
    };
  }, [stepId, listingId, sent]);

  /* V-74: what similar homes in the area are asking, on the money steps only. */
  const guideSubject = useMemo<GuideSubject>(
    () => ({
      stateCode: values.stateCode,
      city: values.city.trim() === "" ? null : values.city.trim(),
      area: values.area.trim() === "" ? null : values.area.trim(),
      propertyType: values.propertyType as GuideSubject["propertyType"],
      intent: values.intent,
      rentPeriod: forSale ? null : values.rentPeriod,
      bedrooms: values.bedrooms,
    }),
    [values.stateCode, values.city, values.area, values.propertyType, values.intent, values.rentPeriod, values.bedrooms, forSale],
  );
  const priceGuide = usePriceGuide(guideSubject, Boolean(guideCopy) && (stepId === "price" || stepId === "charges") && !shortStay);

  const words = countWords(values.description);
  /* SEC-06: the database holds a listing that states a tenant preference for
     review; this says so while the lister is still typing. */
  const preference = tenantPreference(`${values.title} ${values.description}`);
  const amenityNames = copy.amenities.names as Record<string, string | undefined>;
  const amenityLabels = chosenAmenities.map((code) => amenityNames[code] ?? amenities.find((a) => a.code === code)?.label ?? code);
  /* The words after the headline figure, from the dictionary's own period table. */
  const pricePeriod = forSale
    ? copy.pricing.period.sale
    : tenancy
      ? copy.pricing.period[values.rentPeriod]
      : perHead
        ? copy.pricing.period.guest
        : copy.pricing.period.night;

  const unmet = useMemo(
    () =>
      submitRequirements({
        title: values.title,
        description: values.description,
        propertyType: values.propertyType,
        stateCode: values.stateCode,
        city: values.city,
        area: values.area,
        intent: values.intent,
        rentMinor: tenancy ? rentMinor : null,
        rentPeriod: tenancy ? values.rentPeriod : null,
        rateMinor: shortStay ? rateMinor : null,
        ratePeriod: shortStay ? ratePeriodFor(values.propertyType) : null,
        salePriceMinor: forSale ? saleMinor : null,
        tenure: values.tenure === "" ? null : values.tenure,
        bedrooms: values.bedrooms,
        bathrooms: values.bathrooms,
        unitShape: values.unit.shape === "" ? null : values.unit.shape,
        amenityCount: chosenAmenities.length,
        photoCount: photos.length,
        videoCount: videos.length,
        hasCover: media[0]?.kind === "photo",
        moveInStatedMinor: tenancy ? statedTotalMinor : null,
        moveInPartsMinor: tenancy ? [partsSumMinor] : [],
      }),
    [
      values,
      tenancy,
      shortStay,
      forSale,
      rentMinor,
      rateMinor,
      saleMinor,
      chosenAmenities.length,
      photos.length,
      videos.length,
      media,
      statedTotalMinor,
      partsSumMinor,
    ],
  );

  /**
   * The gate's verdict, in the agent's language. `submitRequirements` decides
   * which fields are unmet; this decides how each one reads. A field the gate
   * grows later falls through to the message it carried, which is English but
   * never blank.
   */
  function gateText(field: string, fallback: string): string {
    const g = copy.gate;
    switch (field) {
      case "title":
        return collapseSpaces(values.title).length > MAX_TITLE_LENGTH
          ? fill(g.titleLong, { max: MAX_TITLE_LENGTH })
          : fill(g.titleShort, { min: MIN_TITLE_LENGTH });
      case "description":
        return fill(g.description, { min: MIN_DESCRIPTION_WORDS, count: words });
      case "propertyType":
        return g.propertyType;
      case "photos":
        return media.length < MIN_MEDIA ? fill(g.photos, { min: MIN_MEDIA, count: media.length }) : g.cover;
      case "stateCode":
        return g.stateCode;
      case "city":
        return g.city;
      case "area":
        return g.area;
      case "amenities":
        return g.amenities;
      /* The sale and per-head cases are markets the dictionary has not been
         translated for yet, so they read in English rather than printing the
         wrong one of the two it does have. */
      case "rent":
        return values.rentPeriod === "year" ? g.priceYear : g.rent;
      case "rate":
        return perHead ? "Set the price per head in naira." : g.priceNight;
      case "salePrice":
        return "Set the asking price in naira.";
      case "tenure":
        return "Say what title comes with the property, for example Certificate of Occupancy.";
      case "rentPeriod":
        return "Say whether the rent is per year, quarter or month.";
      case "ratePeriod":
        return "Say what the rate covers.";
      case "bedrooms":
        return g.bedrooms;
      case "bathrooms":
        return g.bathrooms;
      case "unitShape":
        return unitCopy.wizardRequired;
      case "totalMoveIn":
        return remainderCopy && moveInRemainderMinor > 0
          ? fill(remainderCopy.gate, { amount: formatMoney(moveInRemainderMinor, locale) })
          : fallback;
      default:
        return fallback;
    }
  }

  /**
   * The line a thing to fix is named by on the check page: one per gate row,
   * named for the market the listing is in, so a sale reads "Asking price and
   * title deed" and never "Price per night".
   */
  function fixRowOf(field: string): { key: string; label: string } {
    const c = copy.submit.checklist;
    if (["rent", "rentPeriod", "rate", "ratePeriod", "salePrice", "tenure"].includes(field)) {
      return {
        key: "price",
        label: forSale
          ? "Asking price and title deed"
          : tenancy
            ? values.rentPeriod === "year"
              ? c.priceYear
              : "Rent and how often it is paid"
            : perHead
              ? "Price per head"
              : c.priceNight,
      };
    }
    if (["bathrooms", "bedrooms", "unitShape"].includes(field)) return { key: "bathrooms", label: c.rooms };
    switch (field) {
      case "title":
        return { key: field, label: c.title };
      case "description":
        return { key: field, label: fill(c.description, { min: MIN_DESCRIPTION_WORDS }) };
      case "photos":
        return { key: field, label: fill(c.photos, { min: MIN_MEDIA }) };
      case "stateCode":
        return { key: field, label: c.stateCode };
      case "city":
        return { key: field, label: c.city };
      case "area":
        return { key: field, label: c.area };
      case "amenities":
        return { key: field, label: c.amenities };
      case "totalMoveIn":
        return { key: field, label: remainderCopy?.gateShort ?? gateText(field, field) };
      default:
        return { key: field, label: gateText(field, field) };
    }
  }

  /** Screen reader wording for the two counter buttons, lowercased in the active locale. */
  const counterAria = useCallback(
    (direction: "fewer" | "more", label: string): string => {
      const template = direction === "fewer" ? copy.basics.counterFewer : copy.basics.counterMore;
      return fill(template, { label: label.toLocaleLowerCase(locale) });
    },
    [copy.basics.counterFewer, copy.basics.counterMore, locale],
  );

  /* ---------------------------------------------------------- draft safety */

  /*
   * Restore a device draft once, and only when the platform did not hand us
   * one, so a stored listing always wins over whatever this browser remembers.
   *
   * The device draft records WHICH listing it is a copy of. When it names a
   * listing the platform did NOT hand back, it is dropped rather than retyped:
   * that listing was deleted or has moved past DRAFT, and writing its old text
   * into a brand new row would resurrect something already settled.
   */
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    if (initial) return;
    /* SUP-16: one account's draft, never the last person's on this device. */
    const draftKey = listingDraftKey(userId);
    if (!draftKey) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        listingId?: string | null;
        values?: Partial<Values>;
        amenities?: string[];
      };
      if (typeof parsed.listingId === "string" && parsed.listingId.length > 0) {
        localStorage.removeItem(draftKey);
        return;
      }
      if (parsed.values) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring the device copy, once
        setValues((prev) => ({ ...prev, ...parsed.values }));
        setKindPicked(true);
      }
      if (parsed.amenities) setChosenAmenities(parsed.amenities);
    } catch {
      /* a malformed draft is not worth an error message */
    }
  }, [initial, userId]);

  useEffect(() => {
    /* A listing with the review team is not a draft to keep on the device. */
    if (!restored.current || sent) return;
    const draftKey = listingDraftKey(userId);
    if (!draftKey) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({ listingId, values, amenities: chosenAmenities }));
    } catch {
      /* storage unavailable, the platform copy still holds */
    }
  }, [listingId, values, chosenAmenities, userId, sent]);

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setFromMessage((prev) => {
      if (!prev.has(key as string)) return prev;
      const next = new Set(prev);
      next.delete(key as string);
      return next;
    });
    setFieldErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  }

  /**
   * V-09: put a pasted broadcast into the form. ONLY FIELDS STILL AT THEIR
   * EMPTY STARTING VALUE are filled, so nothing the agent typed is ever
   * overwritten, and every field filled is marked "from your message".
   * Returns the keys actually filled, for the panel's list.
   */
  function applyBroadcast(result: BroadcastParse): BroadcastKey[] {
    const taken: BroadcastKey[] = [];
    const next: Partial<Values> = {};
    for (const key of result.filled) {
      const incoming = result.values[key];
      if (incoming === undefined) continue;
      const current = values[key as keyof Values];
      const blank = EMPTY[key as keyof Values];
      if (current !== blank) continue;
      (next as Record<string, unknown>)[key] = incoming;
      taken.push(key);
    }
    if (taken.length === 0) return taken;
    setValues((prev) => ({ ...prev, ...next }));
    setFromMessage((prev) => new Set([...prev, ...taken]));
    /* A message that says what is on offer has answered the first question. */
    setKindPicked(true);
    return taken;
  }

  /** Confirm a filled value as it stands: it leaves the set the gate reads. */
  function confirmFromMessage(keys: readonly string[]) {
    setFromMessage((prev) => {
      const next = new Set(prev);
      for (const key of keys) next.delete(key);
      return next;
    });
  }

  /** The "From your message" mark for one or more fields, or nothing. */
  const mark = (...keys: (keyof Values)[]): React.ReactNode => {
    if (!broadcastCopy) return undefined;
    const live = keys.filter((key) => fromMessage.has(key as string)) as string[];
    if (live.length === 0) return undefined;
    return <FromMessageMark tag={broadcastCopy.tag} confirm={broadcastCopy.confirm} onConfirm={() => confirmFromMessage(live)} />;
  };

  const unconfirmedMoney = BROADCAST_MONEY_KEYS.filter((key) => fromMessage.has(key));
  /** Whether Send for review is held. */
  const sendBlocked = unmet.length > 0 || unconfirmedMoney.length > 0 || marksUnread || feeHolds;

  /* --------------------------------------------------------------- saving */

  /**
   * The title the save sends: the lister's own, or, before they reach the
   * Finish step, a working title from their answers ("3 bedroom flat to let
   * in Yaba, Lagos"), so the account draft exists from the location onward
   * (R18.3) and photos have a listing to attach to. It is put on screen as
   * soon as the save lands, and the Finish step says it was started for them.
   */
  const workingTitle = values.title.trim().length >= 2 ? values.title : titleFromAnswers(values);

  /** Push the current state to the platform. Returns the listing id, or null. */
  const persist = useCallback(async (): Promise<string | null> => {
    if (!canPersist) return null;
    /* Nothing is sent below two characters. That is only a successful save
       when a stored draft already exists; with none, `go` and `send` must
       not treat the step as saved. */
    if (workingTitle.trim().length < 2) {
      lastSaveOk.current = listingId !== null;
      return listingId;
    }
    const started = values.title.trim().length < 2;

    /* A server action can throw rather than answer: a dropped connection, or a
       deploy between two taps. It is caught here, said plainly, and recorded
       so `go` does not move on from a step that did not save. */
    setSaving(true);
    let result: Awaited<ReturnType<typeof saveDraft>>;
    try {
      result = await saveDraft({
      id: listingId ?? undefined,
      /* V-09: the unconfirmed set goes to the server in the same save. */
      broadcastUnconfirmed: marksUnread ? undefined : [...fromMessage],
      title: workingTitle,
      /* EVERY BOX THE LISTER EMPTIED IS SENT AS NULL, which the action reads as
         "clear the column". Undefined is only ever "not this save's business". */
      description: cleared(values.description),
      propertyType: values.propertyType,
      stateCode: values.stateCode === "" ? null : values.stateCode,
      city: cleared(values.city),
      area: cleared(values.area),
      address: cleared(values.address),
      landmark: cleared(values.landmark),
      bedrooms: values.bedrooms,
      bathrooms: values.bathrooms,
      toilets: cleared(values.toilets),
      parkingSpaces: cleared(values.parkingSpaces),
      floor: cleared(values.floor),
      totalFloors: cleared(values.totalFloors),
      sizeSqm: cleared(values.sizeSqm),
      intent: values.intent,
      rentNaira: cleared(values.rentNaira),
      rentPeriod: values.rentPeriod,
      rentNegotiable: values.rentNegotiable,
      cautionDepositNaira: cleared(values.cautionDepositNaira),
      serviceChargeNaira: cleared(values.serviceChargeNaira),
      serviceChargePeriod: values.serviceChargePeriod,
      agencyFeeNaira: cleared(values.agencyFeeNaira),
      legalFeeNaira: cleared(values.legalFeeNaira),
      agreementFeeNaira: cleared(values.agreementFeeNaira),
      totalMoveInNaira: cleared(values.totalMoveInNaira),
      minimumTenancyMonths: cleared(values.minimumTenancyMonths),
      availableFrom: cleared(values.availableFrom),
      furnished: values.furnished === "" ? null : values.furnished,
      rateNaira: cleared(values.rateNaira),
      salePriceNaira: cleared(values.salePriceNaira),
      saleAgencyFeeNaira: cleared(values.saleAgencyFeeNaira),
      saleLegalFeeNaira: cleared(values.saleLegalFeeNaira),
      governorsConsentFeeNaira: cleared(values.governorsConsentFeeNaira),
      stampDutyNaira: cleared(values.stampDutyNaira),
      surveyRegistrationFeeNaira: cleared(values.surveyRegistrationFeeNaira),
      totalPurchaseNaira: cleared(values.totalPurchaseNaira),
      priceNegotiable: values.priceNegotiable,
      tenure: values.tenure === "" ? null : values.tenure,
      saleStatus: values.saleStatus,
      yearBuilt: cleared(values.yearBuilt),
      condition: values.condition === "" ? null : values.condition,
      powerGrid: values.powerGrid === "" ? null : values.powerGrid,
      powerBackup: values.powerBackup === "" ? null : values.powerBackup,
      powerBackupHours: cleared(values.powerBackupHours),
      waterSupply: values.waterSupply === "" ? null : values.waterSupply,
      prepaidMeter: values.prepaidMeter,
      /* A group whose saved answers could not be read, and which the lister
         has not touched, is left out: sending its empty form would write
         nulls over answers this screen never saw (review 13). */
      ...(untouchedUnread(unread, "compound", values.compound, EMPTY_COMPOUND_FORM) ? {} : compoundPayload(values.compound)),
      ...(untouchedUnread(unread, "service", values.service, EMPTY_SERVICE_FORM) ? {} : servicePayload(values.service)),
      ...(untouchedUnread(unread, "unit", values.unit, EMPTY_UNIT_FORM) ? {} : unitPayload(values.unit, values.bedrooms)),
      ...(untouchedUnread(unread, "flood", values.flooding, "") ? {} : { flooding: values.flooding === "" ? null : values.flooding }),
    });
    } catch {
      lastSaveOk.current = false;
      setSaving(false);
      setSaveFailed(true);
      setNotice(copy.wizard.saveUnreached);
      return listingId;
    }

    if (!result.ok) {
      lastSaveOk.current = false;
      setSaving(false);
      setSaveFailed(true);
      setNotice(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      return listingId;
    }

    lastSaveOk.current = true;
    setNotice(null);
    /* Only the server's own field errors are cleared by a good save. The
       Finish step's title refusal is the client gate's, not the server's, and
       a save that succeeds with a two-letter title must not wipe the sentence
       explaining why Continue did not move. */
    setFieldErrors((prev): Record<string, string> =>
      prev.title && titleGateOpen.current ? { title: prev.title } : {},
    );
    setListingId(result.data.id);
    if (started) {
      setValues((prev) => (prev.title.trim().length < 2 ? { ...prev, title: workingTitle } : prev));
      setTitleStarted(true);
    }

    /* The two follow-up writes are guarded like the first: either one
       throwing used to reject the whole transition, and either one refusing
       let `go` and `send` carry on as if everything had saved. */
    try {
      const amenityResult = await setAmenities({
        listingId: result.data.id,
        codes: chosenAmenities,
      });
      if (!amenityResult.ok) {
        lastSaveOk.current = false;
        setNotice(amenityResult.error);
      }

      /* The gate details go to their own table, which the public page cannot
         read. Written on every autosave like everything else. */
      const accessResult = await setListingAccess({
        listingId: result.data.id,
        estateName: values.estateName,
        gateDirections: values.gateDirections,
        securityPhone: values.securityPhone,
        accessCode: values.accessCode,
      });
      if (!accessResult.ok) {
        lastSaveOk.current = false;
        setNotice(accessResult.error);
        const accessErrors = accessResult.fieldErrors;
        if (accessErrors) setFieldErrors((prev) => ({ ...prev, ...accessErrors }));
      }
    } catch {
      lastSaveOk.current = false;
      setNotice(copy.wizard.saveUnreached);
    }
    setSaving(false);
    setSaveFailed(!lastSaveOk.current);
    if (lastSaveOk.current) setSavedAt(formatDate(new Date(), locale, { hour: "2-digit", minute: "2-digit" }));

    return result.data.id;
  }, [canPersist, chosenAmenities, listingId, values, unread, fromMessage, marksUnread, copy.wizard.saveUnreached, workingTitle, locale]);

  /** The frame that scrolls: the step's overlay. A new step starts at its top. */
  const scrollFrameTop = () => {
    document.querySelector<HTMLElement>('[data-testid="listing-steps"]')?.scrollTo({ top: 0, behavior: "instant" });
  };

  function go(target: StepId) {
    if (pending) return;
    const to = steps.findIndex((s) => s.id === target);
    if (to < 0) return;
    const forward = to > index;

    /* The first question is answered before anything follows from it. */
    if (forward && current.id === "kind" && !kindPicked) {
      feedback("error");
      banner.info(WW.kind.pickFirst);
      return;
    }

    // The title is the one thing asked for before moving on, and the sentence
    // shown is the gate's own, so the Finish step and the check page never
    // phrase the same requirement two different ways. The draft is still saved
    // before we stop, because a refusal must never cost the agent their work.
    const titleIssue = unmet.find((item) => item.field === "title");
    if (forward && current.id === "describe" && titleIssue) {
      titleGateOpen.current = true;
      setFieldErrors((prev) => ({ ...prev, title: gateText("title", titleIssue.message) }));
      /* The refusal is immediate (CRAFT_DOCTRINE 5): focusing the field brings
         it into view in one move; the field shakes once and says why. */
      const field = document.getElementById("listing-title-field");
      refuse(field);
      field?.querySelector("input")?.focus();
      feedback("error");
      startTransition(async () => {
        try {
          await persist();
        } catch (error) {
          if (!tapFailedOffline(error)) throw error;
        }
      });
      return;
    }
    titleGateOpen.current = false;

    startTransition(async () => {
      try {
        await persist();
        /* Moving forward from a step whose save was refused left the refusal
           on a step no longer shown. Stay, and show why. Going back is always
           allowed. */
        if (!lastSaveOk.current && forward) {
          scrollFrameTop();
          feedback("error");
          return;
        }
        setTravel({ dir: forward ? "forward" : "back", moved: true });
        setStepId(target);
        /* Arriving at (or past) the step a Change came from ends the way back. */
        setReturnTo((prev) => {
          if (prev === null) return prev;
          const back = steps.findIndex((s) => s.id === prev);
          return to >= back ? null : prev;
        });
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

  /**
   * A Change or a Fix on the check page: go to the step that owns the answer,
   * and remember where the lister came from, so one tap brings them back
   * (`returnTo`, the frame's quiet second action) instead of Continue through
   * every step in between.
   */
  function editStep(target: StepId) {
    const to = steps.findIndex((s) => s.id === target);
    if (pending || to < 0 || to >= index) return;
    setReturnTo(current.id);
    go(target);
  }

  /* A new step starts at the top of the frame, before it paints. */
  useLayoutEffect(() => {
    if (travel.moved) scrollFrameTop();
  }, [stepId, travel.moved]);

  /* Sent: the check page's controls are gone from under the lister's thumb,
     so the frame is put on the card, before it paints, and the card lands
     there (lister-publish.css). One move, to the subject. */
  const sentNow = sent?.now === true;
  useLayoutEffect(() => {
    if (sentNow) cardRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [sentNow]);

  /* --------------------------------------------------------------- photos */

  async function onFiles(files: FileList | readonly File[] | null) {
    if (!files || files.length === 0) return;
    /* Copied now: a FileList is live and the input is emptied below. */
    const chosen = Array.from(files);
    setPhotoNotice(null);
    setPhotoProblems([]);
    setRetryFiles([]);

    if (!canPersist || !userId) {
      setPhotoNotice(copy.photos.needsKeys);
      return;
    }

    setUploading(true);
    try {
      const id = listingId ?? (await persist());
      if (!id) {
        /* No listing to attach to. With a title that is because the save did
           not reach the server, which a second try can fix; without one, the
           title is what is missing. */
        if (workingTitle.trim().length >= 2) {
          setPhotoNotice(copy.wizard.saveUnreached);
          setRetryFiles(chosen);
        } else {
          setPhotoNotice(WW.kind.needsAnswers);
        }
        return;
      }

      /* The browser client loads now, when photos are chosen, not with the
         wizard (lib/supabase/load-client.ts). A chunk that cannot be fetched
         is the upload failure the wizard already says for a photo. */
      const supabase = await loadBrowserClient();
      if (!supabase) {
        setPhotoNotice(copy.photos.uploadFailed);
        setRetryFiles(chosen);
        return;
      }
      let slot = photos.length;
      /*
       * ONE LINE PER REFUSED FILE. A single notice was overwritten by every
       * later file, so choosing six photos with two bad ones showed at most
       * the last refusal, without saying which photo it was about.
       *
       * AND THE ONES A SECOND TRY CAN FIX ARE KEPT. A dropped connection on
       * the upload or on the attach is not a problem with the photo, so those
       * files are held for "Try again" rather than sent back to the gallery
       * to be found and chosen a second time. A refusal about the photo itself
       * (too small, wrong type, too big) is not kept: trying it again changes
       * nothing.
       */
      const problems: string[] = [];
      const retry: File[] = [];
      const refuse = (file: File, reason: string, again = false) => {
        problems.push(fileLine(file.name, reason));
        if (again) retry.push(file);
      };

      let videoCount = videos.length;
      for (const file of chosen) {
        /* A VIDEO, mixed in with the photos in the one picker. */
        if (looksLikeVideo(file)) {
          if (videoCount >= MAX_VIDEOS) {
            refuse(file, fill(copy.photos.videoCeiling, { max: MAX_VIDEOS }));
            continue;
          }
          const added = await uploadVideo(file, id, supabase, refuse);
          if (added) {
            setMedia((prev) => [...prev, added]);
            videoCount += 1;
          }
          continue;
        }
        if (slot >= MAX_PHOTOS) {
          refuse(file, fill(copy.photos.ceiling, { max: MAX_PHOTOS }));
          continue;
        }
        const verdict = judgePhoto(file, looksLikeImage(file) ? await sizeOf(file) : null);
        if (verdict === "not-image") {
          refuse(file, copy.photos.notAnImage);
          continue;
        }
        if (verdict === "heic-undecodable") {
          refuse(file, copy.photos.heicUndecodable);
          continue;
        }
        if (verdict === "undecodable") {
          refuse(file, copy.photos.undecodable);
          continue;
        }
        if (verdict === "too-small") {
          refuse(file, fill(copy.photos.tooNarrow, { width: MIN_PHOTO_WIDTH }));
          continue;
        }

        // Strip location metadata before the photo leaves the device.
        const clean = await stripMetadata(file);
        if (!clean) {
          refuse(file, isHeic(file) ? copy.photos.heicUndecodable : copy.photos.notPrepared);
          continue;
        }

        /*
         * THE BUCKET'S OWN CEILING, CHECKED BEFORE THE BYTES LEAVE.
         *
         * `MAX_UPLOAD_BYTES` (a video's) is far above the `listing-photos`
         * bucket's ten megabytes, so a photograph between the two was
         * uploaded in full on somebody's mobile data and then refused by
         * storage at the very end. The re-encode above usually lands well
         * under ten, which is exactly why this is measured on the RE-ENCODED
         * blob: that is the object that will be posted, and the original's
         * size says nothing about it.
         */
        const tooBig = rejectUpload(
          { type: clean.contentType, size: clean.blob.size },
          PHOTO_MIME_TYPES,
          MAX_PHOTO_BYTES,
        );
        if (tooBig) {
          refuse(file, tooBig);
          continue;
        }

        const path = `${userId}/${id}/${crypto.randomUUID()}.${clean.extension}`;

        let uploadError: { message?: string; statusCode?: string | number } | null = null;
        try {
          const upload = await uploadToStorage({
            supabase,
            bucket: "listing-photos",
            path,
            body: clean.blob,
            contentType: clean.contentType,
          });
          if (!upload.ok) {
            uploadError = {
              message: upload.reason === "offline" || upload.reason === "timeout" ? "network" : "failed",
              statusCode: upload.status,
            };
          }
        } catch {
          uploadError = { message: "network" };
        }
        if (uploadError) {
          const reason = uploadErrorText(uploadError, {
            tooBig: fill(copy.photos.uploadTooBig, { max: MAX_PHOTO_LABEL }),
            wrongType: copy.photos.uploadWrongType,
            signedOut: copy.photos.uploadSignedOut,
            failed: copy.photos.uploadFailed,
          });
          refuse(file, reason, reason === copy.photos.uploadFailed);
          continue;
        }

        let attached: Awaited<ReturnType<typeof addPhoto>>;
        try {
          attached = await addPhoto({ listingId: id, storagePath: path, position: slot });
        } catch {
          /* The attach never reached the server, so nothing there removes the
             object it would have named. It is in this lister's own folder of
             a public bucket, so it goes now, best effort, rather than staying
             downloadable for ever under a path no row points at. */
          void supabase.storage
            .from("listing-photos")
            .remove([path])
            .catch(() => undefined);
          refuse(file, copy.wizard.saveUnreached, true);
          continue;
        }
        if (!attached.ok) {
          refuse(file, attached.error);
          continue;
        }

        const url = supabase.storage.from("listing-photos").getPublicUrl(path).data.publicUrl;
        setMedia((prev) => [...prev, { kind: "photo", id: attached.data.photoId, path, url }]);
        slot += 1;
      }
      setPhotoProblems(problems);
      setRetryFiles(retry);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  /**
   * ONE VIDEO, from the picker to the listing: checked (type, size, length),
   * its filmed location taken out, a still drawn from it, uploaded to the
   * private `listing-videos` bucket under the lister's own folder (the photo
   * rule: `<uid>/<listing>/<uuid>`), the still to the photo bucket, and both
   * attached by `addVideo`, which reads the real size and type back from
   * storage. Returns the row item, or null with the reason already said.
   */
  async function uploadVideo(
    file: File,
    id: string,
    supabase: NonNullable<Awaited<ReturnType<typeof loadBrowserClient>>>,
    refuse: (file: File, reason: string, again?: boolean) => void,
  ): Promise<Media | null> {
    const mime = videoMime(file);
    if (file.type !== "" && !(VIDEO_MIME_TYPES as readonly string[]).includes(file.type)) {
      refuse(file, copy.photos.notAnImage);
      return null;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      refuse(file, fill(copy.photos.videoTooBig, { max: MAX_UPLOAD_LABEL }));
      return null;
    }
    const seconds = await videoDuration(file);
    if (seconds === null) {
      refuse(file, copy.photos.videoUnreadable);
      return null;
    }
    if (seconds > MAX_VIDEO_SECONDS) {
      refuse(file, fill(copy.photos.videoTooLong, { seconds: MAX_VIDEO_SECONDS }));
      return null;
    }

    const scrubbed = await scrubVideoLocation(file);
    /* The original's last modified time is kept, so the same file is known
       again on a second press and its upload resumes rather than restarts. */
    const clean = new File([scrubbed], file.name, { type: mime, lastModified: file.lastModified });
    const poster = await posterFrame(clean);

    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) {
      refuse(file, copy.photos.uploadSignedOut);
      return null;
    }

    const folder = `${userId}/${id}/`;
    const pathScope = `listing-videos:${folder}`;
    const path = stableUploadPath(pathScope, folder, clean, () => `${folder}${crypto.randomUUID()}.${videoExtension(file)}`);
    const controller = new AbortController();
    videoAbort.current = controller;
    setVideoProgress({ name: file.name, percent: 0 });
    const result = await resumableUpload({
      file: clean,
      bucket: "listing-videos",
      path,
      supabaseUrl: SUPABASE_URL,
      accessToken: token,
      signal: controller.signal,
      onProgress: (progress) =>
        setVideoProgress({
          name: file.name,
          percent: progress.total > 0 ? Math.min(100, Math.round((progress.uploaded / progress.total) * 100)) : 0,
        }),
    });
    if (videoAbort.current === controller) videoAbort.current = null;
    setVideoProgress(null);
    if (!result.ok) {
      if (result.reason === "cancelled") {
        /* Stopped on purpose: the half-sent bytes are dropped and the next
           try starts clean. */
        forgetUploadPath(pathScope, clean);
        refuse(file, copy.photos.videoCancelled);
        return null;
      }
      /* A dropped connection keeps its path, so pressing again resumes. */
      if (result.reason !== "network") forgetUploadPath(pathScope, clean);
      refuse(file, result.reason === "network" ? copy.photos.videoFailed : result.message, result.reason === "network");
      return null;
    }
    /* Uploaded: whatever the attach says next, this path is finished with
       (attached, or removed by the refusal). */
    forgetUploadPath(pathScope, clean);

    /* The still is a nicety: without it the video still plays. */
    let posterPath: string | undefined;
    if (poster) {
      const stillPath = `${userId}/${id}/${crypto.randomUUID()}.${poster.extension}`;
      try {
        const upload = await uploadToStorage({ supabase, bucket: "listing-photos", path: stillPath, body: poster.blob, contentType: poster.contentType });
        if (upload.ok) posterPath = stillPath;
      } catch {
        /* no still */
      }
    }

    let attached: Awaited<ReturnType<typeof addVideo>>;
    try {
      attached = await addVideo({
        listingId: id,
        storagePath: result.path,
        durationSeconds: seconds,
        ...(posterPath ? { posterPath } : {}),
      });
    } catch {
      void supabase.storage.from("listing-videos").remove([result.path]).catch(() => undefined);
      if (posterPath) void supabase.storage.from("listing-photos").remove([posterPath]).catch(() => undefined);
      refuse(file, copy.wizard.saveUnreached, true);
      return null;
    }
    if (!attached.ok) {
      refuse(file, attached.error);
      return null;
    }
    return {
      kind: "video",
      id: attached.data.videoId,
      url: URL.createObjectURL(clean),
      posterUrl: posterPath ? supabase.storage.from("listing-photos").getPublicUrl(posterPath).data.publicUrl : null,
      durationSeconds: seconds,
    };
  }

  /**
   * Put the row in a new order and store it: photos by rank, videos by place
   * (`reorderMedia`). A refusal puts the row back as the listing holds it, or
   * the cover on screen would not be the cover a renter sees.
   */
  function orderMedia(next: Media[]) {
    const before = media;
    setMedia(next);
    if (!canPersist || !listingId) return;
    startTransition(async () => {
      try {
        let result: Awaited<ReturnType<typeof reorderMedia>>;
        try {
          result = await reorderMedia({
            listingId,
            items: next.map((item) => ({ kind: item.kind, id: item.id })),
          });
        } catch {
          setMedia(before);
          setPhotoNotice(copy.wizard.saveUnreached);
          return;
        }
        if (!result.ok) {
          setMedia(before);
          setPhotoNotice(result.error);
          return;
        }
        setPhotoNotice(null);
        /* Adopt the ids the platform settled on: at the ten photo ceiling one
           photo row is rewritten, and a stale id would break the next move. */
        setMedia((prev) =>
          mergeMedia(
            result.data.photos.map((photo) => ({
              ...photo,
              url: prev.find((item) => item.kind === "photo" && item.path === photo.path)?.url ?? "",
            })),
            result.data.videos.map((video) => ({ ...video })),
          ).map((entry): Media => {
            if (entry.kind === "photo") {
              return { kind: "photo", id: entry.item.id, path: entry.item.path, url: entry.item.url };
            }
            const held = prev.find((item) => item.kind === "video" && item.id === entry.item.id);
            return held ?? { kind: "video", id: entry.item.id, url: "", posterUrl: null, durationSeconds: null };
          }),
        );
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

  /*
   * Move one item one place, which is what the grid's two arrows do. The
   * cover IS the first item, and it has to be a photo, so a move that would
   * put a video first is not offered (`canMove`).
   */
  function moveMedia(from: number, to: number) {
    if (!canMove(media, from, to)) return;
    const next = media.slice();
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    orderMedia(next);
  }

  function dropMedia(index: number) {
    const chosen = media[index];
    if (!chosen) return;
    const before = media;
    /* Taking the cover off leaves the next photo as the cover, never a video. */
    setMedia(photoFirst(media.filter((_, i) => i !== index)));
    if (!canPersist || !listingId) return;
    startTransition(async () => {
      try {
        /* A refused removal put the item back on screen nowhere: the grid
           showed it gone while the listing still held it, and the count the
           submit gate reads disagreed with the one the lister saw. */
        let error: string | null = null;
        try {
          const result =
            chosen.kind === "photo"
              ? await removePhoto({ listingId, photoId: chosen.id })
              : await removeVideo({ listingId, videoId: chosen.id });
          if (!result.ok) error = result.error;
        } catch {
          error = copy.wizard.saveUnreached;
        }
        if (error) {
          setMedia(before);
          setPhotoNotice(error);
        }
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

  /* --------------------------------------------------------------- submit */

  function send() {
    setPhoneGate(false);
    setVerifyGate(false);
    startTransition(async () => {
      try {
        /* Saved first, always: the draft and its unconfirmed set (V-09) must be
           what the server checks, not what it held before the last tap. */
        const id = (await persist()) ?? listingId;
        /* A refused save leaves the stored row behind the screen, and the
           review team would be sent the older version. Stop with the save's
           own refusal on screen instead. */
        if (!lastSaveOk.current) return;
        if (!id) {
          setNotice(canPersist ? WW.frame.needsTitle : copy.submit.needsKeys);
          return;
        }
        /* D60: ONLY WITH THE BLOCKING FLAG ON is the acceptance recorded first,
           and a listing whose acceptance was not recorded is not sent (D51).
           With it off nothing is recorded and nothing waits. */
        if (feeGateBlocking) {
          if (!feeAcceptance || !feeAccepted) return;
          const recorded = await recordListerFeeAcceptance({ listingId: id, ...feeAcceptance }).catch(() => null);
          if (!recorded || !recorded.ok) {
            setNotice(recorded && !recorded.ok ? recorded.error : copy.wizard.saveUnreached);
            if (recorded && !recorded.ok) setFeeAcceptance(null);
            return;
          }
        }
        let result: Awaited<ReturnType<typeof submitListing>>;
        try {
          result = await submitListing({ listingId: id });
        } catch {
          setNotice(copy.wizard.saveUnreached);
          feedback("error");
          return;
        }
        if (!result.ok) {
          /* The server's gate reads the STORED listing, so it can refuse what
             the checklist here passed (a cover left at a gap after a removed
             photo, a save that did not land). Its summary says "each one is
             listed below", so the reasons are listed, in the checklist's own
             words, rather than leaving a green checklist under a refusal. */
          const reasons = Object.entries(result.fieldErrors ?? {}).map(([field, message]) => gateText(field, message));
          setNotice([result.error, ...new Set(reasons)].join(" "));
          setPhoneGate(result.gate === "phone");
          setVerifyGate(result.gate === "verification");
          setFieldErrors(result.fieldErrors ?? {});
          feedback("error");
          return;
        }
        setNotice(null);
        setFieldErrors({});
        /* ACCEPTED, and only now: the card the lister built stays where it is,
           its status turns to the server's word, the step's controls give way to
           the chain, and the hand feels one medium beat because a commit was
           accepted. Nothing pops and nothing is heavy: the listing is not live,
           and the payoff waits for the day it is (lister-live). */
        setSent({ status: result.data.status, at: result.data.submittedAt ?? null, now: true });
        setTravel((prev) => ({ ...prev, moved: true }));
        feedback("confirm");
        try {
          const draftKey = listingDraftKey(userId);
          if (draftKey) localStorage.removeItem(draftKey);
        } catch {
          /* nothing depends on this */
        }
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

  /* ----------------------------------------------------------- the render */

  const price = priceMinor > 0 ? formatMoney(priceMinor, locale) : null;
  const stateName = states.find((s) => s.code === values.stateCode)?.name ?? "";
  const sentWords = success ? successCopy(success, "listingSubmitted") : null;
  /*
   * THE CARD AS A MEMBER WILL SEE IT, built from the lister's own work: the
   * cover photo, the title, the place, the price. Step 7 shows it too, and
   * once the listing is sent it is the same element that stays on screen
   * while everything around it changes (round 5): the lister watches THIS
   * card go to review, not a confirmation page that replaced it.
   */
  const memberCard = (
    <article className="nf-panel nf-panel--card block overflow-hidden" data-testid="member-card">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--nf-surface-raised)]">
        {photos[0] ? (
          /* The guest view's cover: one wide 4:3 plate, so it earns a
             larger candidate than the grid above it. */
          <RemoteImage
            src={photos[0].url}
            alt=""
            width={960}
            height={720}
            sizes="(max-width: 48rem) 100vw, 30rem"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
            {copy.guestView.addPhotos}
          </div>
        )}
        <div
          /* The platform scrim, not a hand-rolled black gradient. One
             definition, used by the listing card and the gallery too, so
             a preview of a card matches the card it previews. */
          className="absolute inset-x-0 bottom-0 h-20"
          style={{ backgroundImage: "var(--nf-scrim-media)" }}
          aria-hidden="true"
        />
        {/* One badge, and which one it is says which market this is. The
            instant-book badge is gone with the column behind it. */}
        {forSale ? (
          <span className="nf-badge nf-badge--warning absolute left-3 top-3">
            For sale
          </span>
        ) : rental ? (
          <span className="nf-badge nf-badge--brand absolute left-3 top-3">
            {copy.guestView.rentBadge}
          </span>
        ) : null}
        {/*
          ON MEDIA, WHICH IS ITS OWN TOKEN FAMILY.

          This line sits on the listing's own photograph, so it is not
          a dark-theme colour and it is not a light-theme colour: it is
          ink on somebody's picture, in both themes, and
          `--nf-content-on-media` is the token that says so. The
          `text-white/90` and `text-white/70` it replaces happened to
          look right and could never follow a theme, which is exactly
          the distinction the on-media family exists to hold.
        */}
        <p className="nf-body-sm absolute bottom-3 left-3 right-3 flex items-center gap-inline-tight font-semibold text-[var(--nf-content-on-media)]">
          <UiIcon
            name="location"
            size={12}
            className="shrink-0 text-[var(--nf-content-on-media-muted)]"
          />
          <span className="truncate">
            {[values.area, values.city, stateName].filter(Boolean).join(", ") ||
              copy.guestView.locationPlaceholder}
          </span>
        </p>
      </div>
      <div className="p-card">
        <h3 className="text-[length:var(--nf-text-body-sm)] font-semibold leading-snug">
          {values.title || copy.guestView.titlePlaceholder}
        </h3>
        <p className="nf-body-sm mt-inline-tight text-[var(--nf-content-muted)]">
          {/* The dictionary sentence names a guest count this model no
              longer has, so the preview states the two facts it does
              hold rather than printing a number nothing stores. */}
          {[
            `${values.bedrooms} bed`,
            `${values.bathrooms} bath`,
            values.toilets ? `${values.toilets} toilet` : null,
            values.sizeSqm ? `${values.sizeSqm} sqm` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <p className="mt-inline flex items-baseline gap-inline-tight">
          <span className="nf-numeric text-[length:var(--nf-text-body-lg)] font-bold">
            {price ?? copy.guestView.priceToSet}
          </span>
          <span className="text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
            {pricePeriod}
          </span>
        </p>
        {chosenAmenities.length > 0 && (
          <p className="nf-body-sm mt-inline text-[var(--nf-content-secondary)]">
            {chosenAmenities
              .map(
                (code) =>
                  amenityNames[code] ??
                  amenities.find((a) => a.code === code)?.label ??
                  code,
              )
              .slice(0, 4)
              .join(" · ")}
          </p>
        )}
      </div>
    </article>
  );

  /* ------------------------------------------------------- the questions */

  const ctx: StepCtx = {
    values,
    set,
    mark,
    errors: fieldErrors,
    copy,
    moveInCopy,
    moneyMapCopy,
    remainderCopy,
    locale,
    kind,
    asks,
    money,
    counterAria,
  };

  const guidePanel = guideCopy ? (
    <PriceGuidePanel subject={guideSubject} loading={priceGuide.loading} guide={priceGuide.guide} copy={guideCopy} locale={locale} />
  ) : null;

  /** The question each step asks, in the market this listing is in. */
  function wordsFor(id: StepId): { title: string; subtitle?: string } {
    const byKind = (rent: string, sale: string, stay: string) => (forSale ? sale : tenancy ? rent : stay);
    switch (id) {
      case "kind":
        return { title: WW.kind.title, subtitle: WW.kind.subtitle };
      case "type":
        return { title: WW.type.title, subtitle: WW.type.subtitle };
      case "location":
        return { title: WW.location.title, subtitle: WW.location.subtitle };
      case "rooms":
        if (values.propertyType === "land") return { title: WW.rooms.titleLand, subtitle: WW.rooms.subtitleLand };
        return { title: asks("bedrooms") ? WW.rooms.title : WW.rooms.titleWorkspace, subtitle: WW.rooms.subtitle };
      case "place":
        return { title: WW.place.title, subtitle: WW.place.subtitle };
      case "supply":
        return { title: WW.supply.title, subtitle: WW.supply.subtitle };
      case "compound":
        return { title: WW.compound.title, subtitle: WW.compound.subtitle };
      case "access":
        return { title: WW.access.title, subtitle: WW.access.subtitle };
      case "amenities":
        return { title: WW.amenities.title, subtitle: WW.amenities.subtitle };
      case "price":
        return {
          title: byKind(WW.price.titleRent, WW.price.titleSale, perHead ? WW.price.titleHead : WW.price.titleStay),
          subtitle: byKind(WW.price.subtitleRent, WW.price.subtitleSale, WW.price.subtitleStay),
        };
      case "charges":
        return {
          title: byKind(WW.charges.titleRent, WW.charges.titleSale, WW.charges.titleStay),
          subtitle: byKind(WW.charges.subtitleRent, WW.charges.subtitleSale, WW.charges.subtitleStay),
        };
      case "terms":
        return {
          title: byKind(WW.terms.titleRent, WW.terms.titleSale, WW.terms.titleStay),
          subtitle: byKind(WW.terms.subtitleRent, WW.terms.subtitleSale, WW.terms.subtitleStay),
        };
      case "photos":
        return { title: WW.photos.title, subtitle: fill(WW.photos.subtitle, { min: MIN_MEDIA }) };
      case "describe":
        return { title: WW.describe.title, subtitle: WW.describe.subtitle };
      case "check":
        return sent
          ? { title: sentWords?.title ?? copy.submitted.title, subtitle: sentWords?.body ?? copy.submitted.body }
          : { title: WW.check.title, subtitle: WW.check.subtitle };
    }
  }

  /* THINGS TO FIX on the check page: the gate's verdict, one line per row,
     each with the step that fixes it, and the gates that live outside the
     flow (identity, the broadcast's unchecked figures, the fee acceptance,
     a stay's charges at the door). */
  const fixes: Fix[] = [];
  if (verifyFirst && !verifyGate) {
    fixes.push({
      key: "verify",
      label: WW.check.verify,
      detail: WW.check.verifyBody,
      href: "/verification",
      hrefLabel: WW.check.verifyAction,
      testId: "verify-first",
    });
  }
  const seenRows = new Set<string>();
  for (const problem of unmet) {
    const row = fixRowOf(problem.field);
    if (seenRows.has(row.key)) continue;
    seenRows.add(row.key);
    fixes.push({
      key: row.key,
      label: row.label,
      detail: gateText(problem.field, problem.message),
      step: stepOfGateField(problem.field, steps),
    });
  }
  if (broadcastCopy && marksUnread) {
    fixes.push({ key: "broadcast-unread", label: broadcastCopy.marksUnreachable, testId: "broadcast-unread" });
  }
  if (broadcastCopy && unconfirmedMoney.length > 0) {
    fixes.push({
      key: "broadcast-confirm",
      label: broadcastCopy.confirmTitle,
      detail: fill(broadcastCopy.confirmBody, {
        fields: unconfirmedMoney.map((key) => broadcastCopy.fields[key]).join(", "),
      }),
      step: stepOfGateField(unconfirmedMoney[0] ?? "rentNaira", steps),
      testId: "broadcast-confirm",
    });
  }
  if (feeHolds) fixes.push({ key: "fee", label: WW.check.feeAccept });
  const doorDeclared = shortStay && arrival && arrival.existing !== undefined ? arrival.existing !== null : null;
  if (doorDeclared === false) {
    fixes.push({ key: "door", label: WW.check.doorCharges, detail: WW.check.doorChargesBody, step: "charges" });
  }

  function questionFor(id: StepId): React.ReactNode {
    switch (id) {
      case "kind":
        return (
          <KindStep
            ctx={ctx}
            picked={kindPicked ? kind : null}
            onPick={(next) => {
              const answer = applyKind(values, next);
              set("intent", answer.intent);
              set("propertyType", answer.propertyType);
              setKindPicked(true);
            }}
            broadcastCopy={broadcastCopy}
            onBroadcast={applyBroadcast}
          />
        );
      case "type":
        return <TypeStep ctx={ctx} />;
      case "location":
        return <LocationStep ctx={ctx} states={states} />;
      case "rooms":
        return <RoomsStep ctx={ctx} />;
      case "place":
        return <PlaceStep ctx={ctx} unitCopy={unitCopy} />;
      case "supply":
        return <SupplyStep ctx={ctx} />;
      case "compound":
        return (
          <CompoundStep ctx={ctx} serviceCopy={serviceCopy} floodCopy={floodCopy} compoundCopy={compoundCopy} floodOpen={floodOpen} />
        );
      case "access":
        return <AccessStep ctx={ctx} />;
      case "amenities":
        return (
          <AmenitiesStep
            ctx={ctx}
            amenities={amenities}
            chosen={chosenAmenities}
            onToggle={(code) =>
              setChosenAmenities((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]))
            }
          />
        );
      case "price":
        return <PriceStep ctx={ctx} guide={guidePanel} />;
      case "charges":
        return (
          <ChargesStep
            ctx={ctx}
            listingId={listingId}
            arrival={arrival}
            agencyHint={guideCopy ? feeNormLine("agency", priceGuide.norms, guideCopy) : null}
            legalHint={guideCopy ? feeNormLine("legal", priceGuide.norms, guideCopy) : null}
          />
        );
      case "terms":
        return <TermsStep ctx={ctx} />;
      case "photos":
        return (
          <PhotosStep
            copy={copy}
            values={values}
            media={media}
            listingId={listingId}
            uploading={uploading}
            busy={pending}
            nativeCamera={nativeCamera}
            problems={photoProblems}
            canRetry={retryFiles.length > 0}
            videoProgress={videoProgress}
            viewerCopy={viewerCopy}
            shotsCopy={shotsCopy}
            onPick={() => fileInput.current?.click()}
            onCamera={() =>
              void capturePhoto().then((shot) => {
                if (shot) void onFiles([shot]);
              })
            }
            onRetry={() => void onFiles(retryFiles)}
            onCancelVideo={() => videoAbort.current?.abort()}
            onMove={moveMedia}
            onDrop={dropMedia}
          />
        );
      case "describe":
        return (
          <DescribeStep
            ctx={ctx}
            /* STORE-16: a warning, never a refusal. */
            titleHint={looksLikeStreetAddress(values.title) ? STREET_IN_TITLE_WARNING : copy.basics.titleHint}
            amenityLabels={amenityLabels}
            stateName={stateName}
            aiConsented={aiConsented}
            preference={preference}
            titleFromAnswersShown={titleStarted}
          />
        );
      case "check":
        return (
          <div className="nf-lw-publish" data-sent={sent ? (sent.now ? "now" : "settled") : undefined}>
            {/* The card heads the check page, so what is being sent is in view
                as it is sent; its status is the workspace's word for where it
                stands, the server's once it has answered. Keyed so the word
                crossfades as it turns, and the SAME element after sending. */}
            <div className="nf-lw-publish__label">
              <p className="nf-label">{listerCopy?.publish.cardLabel ?? copy.guestView.intro}</p>
              <span key={sent?.status ?? "DRAFT"} className="nf-lw-publish__status" data-testid="member-card-status">
                <StatusPill tone={toneForStatus(sent?.status ?? "DRAFT")}>{copy.workspace.status[sent?.status ?? "DRAFT"]}</StatusPill>
              </span>
            </div>
            <div className="nf-lw-publish__card mt-row" ref={cardRef}>
              {memberCard}
            </div>
            {sent ? (
              <>
                <ListingSentForReview
                  copy={copy}
                  reference={reference}
                  lister={listerCopy}
                  status={sent.status}
                  submittedAt={sent.at}
                  locale={locale}
                />
                {/* Sent: the lister now wants to know when somebody asks. */}
                <PushPrompt moment="listing_published" />
              </>
            ) : (
              <div className="nf-lw-publish__send mt-heading grid grid-cols-1 gap-md">
                <CheckStep
                  ctx={ctx}
                  steps={steps}
                  media={media}
                  amenityCount={chosenAmenities.length}
                  stateName={stateName}
                  doorDeclared={doorDeclared}
                  fixes={fixes}
                  busy={pending}
                  onChange={editStep}
                  after={
                    <>
                      {/* V-10: whose saved searches this would reach, once it exists. */}
                      {demandCopy && listingId ? <DraftMatches listingId={listingId} copy={demandCopy} /> : null}
                      {/* Drawn once the read has answered (or when there is no saved
                          listing to read for), so "cannot show" never flashes first. */}
                      {feePolicy !== undefined || !listingId ? (
                        <ListerFeeGate
                          kind={feeKind}
                          priceMinor={priceMinor > 0 ? priceMinor : null}
                          policy={feePolicy ?? null}
                          locale={locale}
                          blocking={feeGateBlocking}
                          accepted={feeAcceptance}
                          onAcceptedChange={setFeeAcceptance}
                        />
                      ) : null}
                      <PhoneGateLink show={phoneGate && notice !== null} full className="mt-sm" />
                      <VerifyGateLink show={verifyGate && notice !== null} full className="mt-sm" />
                      <p className="nf-body-sm text-center text-[var(--nf-content-muted)]">{copy.submit.note}</p>
                    </>
                  }
                />
              </div>
            )}
          </div>
        );
    }
  }

  /* ------------------------------------------------------------ the frame */

  const asked = wordsFor(current.id);
  const returnIndex = returnTo === null ? -1 : steps.findIndex((s) => s.id === returnTo);
  const save: StepSaveState = saving
    ? "saving"
    : saveFailed
      ? "error"
      : savedAt && listingId
        ? "saved"
        : deviceKeeps && !sent
          ? "device"
          : "idle";

  const primary: StepAction = sent
    ? { label: copy.submitted.goToListings, onClick: () => router.push("/agent/listings"), testId: "listing-go" }
    : current.id === "check"
      ? { label: copy.submit.action, onClick: send, disabled: sendBlocked, loading: pending, testId: "listing-send" }
      : {
          label: WW.frame.continue,
          onClick: () => {
            const next = steps[index + 1];
            if (next) go(next.id);
          },
          disabled: current.id === "kind" && !kindPicked,
          loading: pending,
          testId: "step-continue",
        };
  const secondary: StepAction | undefined = sent
    ? {
        /* "List another" is the one control that means a blank wizard
           (`?new=`); each press is a new value, which the page keys the
           wizard by, so nothing of the sent listing carries over. */
        label: copy.submitted.another,
        onClick: () => router.push(`/agent/list?new=${Date.now()}`),
        testId: "listing-another",
      }
    : returnTo !== null && index < returnIndex
      ? { label: fill(copy.wizard.returnTo, { step: wordsFor(returnTo).title }), onClick: () => go(returnTo), testId: "wizard-return" }
      : undefined;

  const notices = (
    <>
      {!canPersist ? <Note>{copy.wizard.unconfiguredNotice}</Note> : null}
      {/* A listing sent back by review reopens with the reviewer's sentence in
          front of the lister, on every step. */}
      {reviewerAsked(initial) ? (
        <div data-testid="reviewer-note">
          <Note glyph="flag">
            <span className="block font-semibold">What the reviewer said</span>
            <span className="block">{initial?.reviewNotes}</span>
          </Note>
        </div>
      ) : null}
    </>
  );
  const hasNotice = !canPersist || reviewerAsked(initial);

  return (
    <StepFrame
      overlay
      testId="listing-steps"
      step={index + 1}
      total={steps.length}
      stepLabel={fill(WW.frame.stepOf, { n: index + 1, total: steps.length })}
      eyebrow={WW.eyebrows[current.eyebrow]}
      title={asked.title}
      subtitle={asked.subtitle}
      direction={travel.dir}
      {...(index > 0 && !sent ? { onBack: () => go(steps[index - 1]!.id) } : {})}
      backLabel={copy.wizard.back}
      closeHref="/agent/listings"
      onClose={() => router.push("/agent/listings")}
      closeLabel={WW.frame.close}
      save={save}
      saveWords={{
        saved: savedAt ? `${WW.frame.saved} ${savedAt}` : WW.frame.saved,
        saving: WW.frame.saving,
        device: WW.frame.device,
        error: WW.frame.error,
      }}
      primary={primary}
      {...(secondary ? { secondary } : {})}
      {...(hasNotice ? { notice: notices } : {})}
    >
      <div className="nf-lw-wizard grid grid-cols-1 gap-md" data-step={current.id}>
        <FocusKeeper frameTestId="listing-steps" />
        {/* Photos and videos in the one picker (founder, 12 October). Always in
            the frame, so the photo step and the check page share one input. */}
        <input
          ref={fileInput}
          type="file"
          accept={["image/*", ...VIDEO_MIME_TYPES].join(",")}
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => void onFiles(e.target.files)}
        />
        {questionFor(current.id)}
      </div>
    </StepFrame>
  );
}
