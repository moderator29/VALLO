"use client";

import { PhoneGateLink } from "@/components/app/PhoneGateLink";
import { useHostCopy, useHostPageCopy } from "@/components/host/host-copy";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useBack } from "@/lib/nav/use-back";
import { useBackGuard } from "@/lib/ui/use-back-guard";
import { whenSheetsClosed } from "@/lib/ui/use-sheet-history";
import { countOf, type Locale } from "@vallo/i18n/core";
import { useScopedCopy } from "@/lib/i18n/copy-scope";
import { useMoneyStepUp } from "@/components/app/money/MoneyStepUp";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { SuccessSheet } from "@/components/ui/SuccessSheet";
import { Unfold } from "@/components/ui/Unfold";
import { ProgressPath } from "@/components/supply/ProgressPath";
import { HOST_STEP_TILES, HOST_TYPE_TILES } from "@/components/supply/path-tiles";
import { successCopy } from "@/lib/ui/success-moments";
import { SelectField, TextArea, TextField } from "@/components/ui/Field";
import { TYPE } from "@/components/app/Screen";
import type { ActionResult } from "@/lib/actions/envelope";
import { saveHostDraft, submitHostApplication } from "@/lib/host/actions";
import {
  BUSINESS_SECTIONS,
  CONSENTS,
  HOST_TYPE_DEFINITIONS,
  HOST_TYPES,
  branchFor,
  hostsAccommodation,
  mergeServerDraft,
  missingFrom,
  progressLabel,
  stepsFor,
  type BusinessKind,
  type ConsentId,
  type HostDocumentKind,
  type HostDraft,
  type HostStepId,
} from "@/lib/host/onboarding";
import type { StaysDoor } from "@/lib/host/doors";
import {
  addBankAccount,
  listBanks,
  resolveBankAccount,
} from "@/lib/payments/bank-accounts-actions";
import { BusinessPhotoManager } from "./BusinessPhotoManager";
import { HeldProvider, differs, useGuard, useHeld, useWizardMemory } from "./wizard-memory";
import { ExtraChargesStep } from "./stays/ExtraChargesStep";
import type { Dictionary } from "@vallo/i18n/core";
import { HostDocumentUploader } from "./HostDocumentUploader";
import { FacilitiesStep } from "./stays/FacilitiesStep";
import { HotelStep } from "./stays/HotelStep";
import { HouseRulesStep } from "./stays/HouseRulesStep";
import { PlaceStep } from "./stays/PlaceStep";
import { RatesStep } from "./stays/RatesStep";
import { RestaurantStep } from "./stays/RestaurantStep";
import { RoomTypesStep } from "./stays/RoomTypesStep";
import { StaysHead } from "./stays/StaysParts";
import { TablesStep } from "./stays/TablesStep";
import { Icon3D } from "@/components/ui/Icon3D";
import { HOST_AGREEMENT_VERSION, PAY_ON_VALLO_VERSION } from "@/lib/legal/versions";
import { WorkspaceAcceptance } from "@/components/legal/WorkspaceAcceptance";

/**
 * THE HOST WIZARD, ON `lib/host`.
 *
 * Ten steps at most and one task on each, the steps as data from
 * `lib/host/onboarding.ts` so the count is honest and branch-dependent.
 * The businesses row is created at step two by `saveHostDraft` and every
 * later step writes onto it through its own action; nothing here names a
 * table. What is typed is kept on this device between saves (`nf_host_draft`)
 * so a dropped connection loses nothing, and the server's draft wins on
 * arrival because it is what a reviewer will read.
 *
 * WHAT IS HONEST HERE. The property's photographs are uploaded on the
 * property step itself, through `AccommodationPhotoManager`, and the review
 * step names the gap until one is on record. That step used to say photo
 * upload for properties arrived with the next host release, while the
 * submission gate refused an accommodation with no photograph: nine steps
 * filled in and no way to press send. The map pin is two real
 * coordinates, filled from the device's own location on request. The bank
 * account is resolved with the bank before it is saved and the resolved
 * name is what is shown. Submission is `submitHostApplication`, which
 * refuses with the list of what is missing, printed word for word.
 */

/**
 * A cancellation policy a rate or a property may name.
 *
 * `isFreeUntilHours` rides along because `GOVERNING-10` screen three draws a
 * switch called "Free cancellation" and a row that says how long it lasts, and
 * `cancellation_policies.is_free_until_hours` is the only thing in this
 * database that knows either. Null means a policy is never free.
 */
export type PolicyOption = {
  id: string;
  name: string;
  summary: string;
  isFreeUntilHours: number | null;
  /** The refund tiers (`[{hours_before, refund_bps}]`), printed in plain words. */
  rules?: unknown;
  /** flexible, moderate, firm or strict, when the policy is one of the presets. */
  preset?: string | null;
};

type Notice = { tone: "ok" | "error"; text: string; phoneGate?: boolean } | null;

const STORAGE_KEY = "nf_host_draft";

/* The unsaved-changes prompt's heading, as the founder worded it, and every
   other line of the wizard: `hostWorkspace.wizard` (language audit). */

/*
 * THE WEEKDAYS, THE ROOM CATEGORIES AND THE MEAL PLANS HAVE MOVED OUT OF THIS
 * FILE. They were three lists typed into a component beside three forms that
 * `GOVERNING-10` and `GOVERNING-11` replace; the lists themselves are now in
 * `lib/host/stays-setup.ts`, pure and tested, beside the note saying which
 * database enum each one has to agree with.
 */

/** The text fields of the draft, which is what the device keeps between saves. */
type TextKeys =
  | "name"
  | "description"
  | "phone"
  | "email"
  | "address"
  | "area"
  | "city"
  | "stateCode"
  | "registeredName"
  | "cacNumber"
  | "tin"
  | "representativeName"
  | "representativePhone";

type LocalDraft = Partial<Pick<HostDraft, TextKeys | "hostType" | "kind">>;

function readLocal(): LocalDraft {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? (parsed as LocalDraft) : {};
  } catch {
    return {};
  }
}

function writeLocal(draft: LocalDraft) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    /* Storage unavailable: the server draft still carries every save. */
  }
}

/** The typed business fields, the half of the draft `saveHostDraft` writes. */
const TEXT_FIELDS = [
  "name",
  "description",
  "phone",
  "email",
  "address",
  "area",
  "city",
  "stateCode",
  "registeredName",
  "cacNumber",
  "tin",
  "representativeName",
  "representativePhone",
] as const satisfies readonly TextKeys[];

type SavedText = Pick<HostDraft, TextKeys | "hostType" | "kind">;

function pickText(draft: HostDraft): SavedText {
  const out = { hostType: draft.hostType, kind: draft.kind } as SavedText;
  for (const key of TEXT_FIELDS) (out as Record<string, unknown>)[key] = draft[key];
  return out;
}

/** Where the person is trying to go when the wizard asks about unsaved changes. */
type Leave =
  | { kind: "back" }
  /* The browser's own Back (or the Android Chrome gesture): out of the wizard. */
  | { kind: "history" }
  | { kind: "jump"; index: number }
  | { kind: "link"; href: string };

export function HostWizard({
  initial,
  userId,
  policies,
  locale,
  door = null,
  initialStep = null,
  arrivalCopy,
  acceptCopy,
}: {
  initial: HostDraft;
  /**
   * Ruling 6: the words of the pay-on-Vallo tick (`payChoice.accept`), handed
   * down by the page. Absent (the dev previews), the English line is drawn.
   */
  acceptCopy?: Pick<Dictionary["payChoice"], "accept">;
  /**
   * The words of the Extra charges step (`afterTheGate.arrival`), handed down
   * by the page so the client does not load the dictionary for them.
   */
  arrivalCopy?: Dictionary["afterTheGate"]["arrival"];
  userId: string;
  policies: PolicyOption[];
  locale: Locale;
  /**
   * The stays door this host came through, from `/host/start`.
   *
   * IT ANSWERS THE FIRST STEP, IT DOES NOT REMOVE IT. The host type and the
   * business kind are filled in and the wizard opens on the second step, so
   * somebody who told us "we are a hotel" is not then asked whether they are a
   * registered hospitality business. Back still lands on that step with the
   * door's answer showing, because a hotel that turns out not to be registered
   * has to be able to say so.
   *
   * A DOOR NEVER OVERRIDES A DRAFT IN PROGRESS. Somebody returning to an
   * application they have already started keeps what they answered; the door
   * only fills a blank.
   */
  door?: StaysDoor | null;
  /**
   * THE FIXTURE HARNESS'S WAY IN TO A LATER STEP, and nothing else passes it.
   *
   * Moving forward is a write (`saveHostDraft` creates the business at step
   * two), so a proof of the later steps cannot click its way there. With a
   * step named here the wizard opens on it, over whatever draft it was given;
   * an id the draft's branch does not have is ignored. The routes never pass
   * it (the second audit, S9).
   */
  initialStep?: HostStepId | null;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<HostDraft>(() =>
    door && initial.hostType === null && initial.kind === null
      ? { ...initial, hostType: door.hostType, kind: door.kind }
      : initial,
  );
  const [at, setAt] = useState(() => {
    const opened = initialStep
      ? stepsFor(initial.hostType, initial.kind).findIndex((candidate) => candidate.id === initialStep)
      : -1;
    if (opened >= 0) return opened;
    return door && initial.hostType === null && initial.kind === null ? 1 : 0;
  });
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState<Notice>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  /*
   * THE HOTEL'S STATED TOTAL, WHICH HAS NO COLUMN ANYWHERE IN THIS DATABASE.
   *
   * `GOVERNING-10` screen one asks a hotelier how many rooms they have, and
   * `accommodations` has nowhere to put the answer: the only room count this
   * platform holds is the sum of `room_types.units_total`, which does not
   * exist until screen two. So the number is held here, for the length of the
   * flow, and SPENT on screen two as the first room type's unit count. Both
   * screens say so on the screen itself rather than leaving somebody to find
   * out. It is deliberately not written to the device's draft either: a number
   * that survives a reload but never reaches the server is the worst of the
   * three states, because it looks saved.
   */
  const [expectedRooms, setExpectedRooms] = useState(1);

  /*
   * EVERY SAVE ENDS IN `router.refresh()`, WHICH HANDS THIS COMPONENT A NEW
   * `initial`. The state above is seeded from the first one only, so without
   * this the screen went on drawing the draft from before the save: a room
   * type saved and no Continue, a property saved and "save the property
   * first", a photograph uploaded and nothing shown. `mergeServerDraft` says
   * which half of the draft is the server's and which is still the device's.
   * Adjusted during render rather than in an effect, as `wasSubmitted` below
   * is, so no frame is drawn from the stale copy.
   */
  const [seenInitial, setSeenInitial] = useState(initial);
  /* What the server holds of the typed fields: what "unsaved" is measured
     against, and what Discard puts back. */
  const [savedText, setSavedText] = useState<SavedText>(() => pickText(initial));
  /*
   * THE HOST'S AGREEMENT, ticked on the business step (founder decision B).
   * Nothing is created for a host who has not agreed to the Terms, the Privacy
   * policy and the Host Agreement; the tick rides on the save that creates
   * the business and is recorded there with each version.
   */
  const [agreeNow, setAgreeNow] = useState(false);
  const agreed = draft.hostAgreementVersion === HOST_AGREEMENT_VERSION;
  /* Ruling 6 (13 October 2026): every payment for a deal happens inside Vallo,
     ticked beside the Host Agreement and recorded the same way. */
  const [payNow, setPayNow] = useState(false);
  const payAgreed = draft.payOnValloVersion === PAY_ON_VALLO_VERSION;
  if (seenInitial !== initial) {
    setSeenInitial(initial);
    setDraft((current) => mergeServerDraft(current, initial));
    if (initial.businessId) setSavedText(pickText(initial));
  }

  /* The device's copy of the typed fields, merged UNDER the server's: a
     field the server holds is the truth, a field it does not is what was
     typed before the last save failed. */
  useEffect(() => {
    const local = readLocal();
    setDraft((current) => {
      const merged = { ...current };
      for (const [key, value] of Object.entries(local)) {
        const k = key as keyof LocalDraft;
        if (typeof value === "string" && (merged[k] === "" || merged[k] === null)) {
          (merged as Record<string, unknown>)[k] = value;
        }
      }
      return merged;
    });
  }, []);

  /*
   * THE STEP LIST NOW DEPENDS ON THE KIND AS WELL AS THE HOST TYPE, because a
   * shortlet operator and a hotelier are both accommodation hosts and
   * `GOVERNING-10` and `GOVERNING-11` ask them entirely different questions.
   */
  const steps = useMemo(() => stepsFor(draft.hostType, draft.kind), [draft.hostType, draft.kind]);
  const step = steps[Math.min(at, steps.length - 1)]!;
  const submitted = draft.status === "SUBMITTED";
  /* What each step has typed and not saved, held here so Back never loses it
     (`components/host/wizard-memory.tsx`). */
  const memory = useWizardMemory(step.id);
  /*
   * The success sheet opens on the TRANSITION to submitted, which only
   * `submitHostApplication`'s ok makes (ReviewStep sets the status in its
   * `then`). A host who opens the wizard already submitted gets no sheet.
   */
  const [celebrate, setCelebrate] = useState(false);
  const [wasSubmitted, setWasSubmitted] = useState(submitted);
  if (wasSubmitted !== submitted) {
    setWasSubmitted(submitted);
    if (submitted) setCelebrate(true);
  }
  /* The page's CopyScope carries these (W13): no client dictionary read. */
  const successWords = useScopedCopy("success");
  const hostPage = useHostPageCopy();
  const hw = useHostCopy();
  /* The progress path's words: the same ones the agent's listing wizard uses
     (`experienceFeatures.wizard`). */
  const pathWords = useScopedCopy("featuresWizard");

  const set = useCallback(<K extends keyof HostDraft>(key: K, value: HostDraft[K]) => {
    setDraft((current) => {
      const next = { ...current, [key]: value };
      const keep: LocalDraft = {};
      for (const k of [
        "hostType",
        "kind",
        "name",
        "description",
        "phone",
        "email",
        "address",
        "area",
        "city",
        "stateCode",
        "registeredName",
        "cacNumber",
        "tin",
        "representativeName",
        "representativePhone",
      ] as const) {
        (keep as Record<string, unknown>)[k] = next[k];
      }
      writeLocal(keep);
      return next;
    });
  }, []);

  /** Run a write, print its refusal, refresh on success. */
  const run = useCallback(
    (work: () => Promise<ActionResult<unknown>>, then?: (data: unknown) => void) => {
      setNotice(null);
      setFieldErrors({});
      start(async () => {
        const result = await work();
        if (!result.ok) {
          setNotice({ tone: "error", text: result.error, phoneGate: result.gate === "phone" });
          if (result.fieldErrors) setFieldErrors(result.fieldErrors);
          return;
        }
        then?.(result.data);
        router.refresh();
      });
    },
    [router],
  );

  /**
   * `run`, awaitable. Every step's save is built on this, so the same save
   * serves the step's own Continue and the wizard's "Save and go back".
   */
  const runAsync = useCallback(
    (work: () => Promise<ActionResult<unknown>>) =>
      new Promise<boolean>((resolve) => {
        setNotice(null);
        setFieldErrors({});
        start(async () => {
          try {
            const result = await work();
            if (!result.ok) {
              setNotice({ tone: "error", text: result.error, phoneGate: result.gate === "phone" });
              if (result.fieldErrors) setFieldErrors(result.fieldErrors);
              resolve(false);
              return;
            }
            router.refresh();
            resolve(true);
          } catch {
            setNotice({ tone: "error", text: hw.wizard.failed });
            resolve(false);
          }
        });
      }),
    [router],
  );

  /** Save the text of the draft, creating the row on the first call. */
  const saveTextAsync = useCallback(
    async (extra: Record<string, unknown> = {}) => {
      const sent = pickText(draft);
      let saved: { businessId: string; status: string } | null = null;
      const done = await runAsync(async () => {
        const result = await saveHostDraft({
          ...(agreeNow && !agreed ? { agreeToHostTerms: true } : {}),
          ...(payNow && !payAgreed ? { agreeToPayOnVallo: true } : {}),
          ...(draft.hostType ? { hostType: draft.hostType } : {}),
          ...(draft.kind ? { kind: draft.kind } : {}),
          name: draft.name,
          description: draft.description,
          phone: draft.phone,
          email: draft.email,
          address: draft.address,
          area: draft.area,
          city: draft.city,
          stateCode: draft.stateCode,
          registeredName: draft.registeredName,
          cacNumber: draft.cacNumber,
          tin: draft.tin,
          representativeName: draft.representativeName,
          representativePhone: draft.representativePhone,
          ...extra,
        });
        if (result.ok) saved = result.data;
        return result;
      });
      const written = saved as { businessId: string; status: string } | null;
      if (done && written) {
        setDraft((current) => ({
          ...current,
          businessId: written.businessId,
          status: written.status as HostDraft["status"],
        }));
        setSavedText(sent);
      }
      return done;
    },
    [draft, runAsync, agreeNow, agreed, payNow, payAgreed],
  );

  const saveText = useCallback(
    (extra: Record<string, unknown> = {}, then?: () => void) => {
      void saveTextAsync(extra).then((done) => {
        if (done) then?.();
      });
    },
    [saveTextAsync],
  );

  /* Moving on after a save: what the step held is now on record. */
  const forward = () => {
    memory.forget(step.id);
    setAt((i) => Math.min(steps.length - 1, i + 1));
  };
  /*
   * ONE BACK CONTROL, AND IT WALKS OUT OF THE FLOW AT THE TOP OF IT.
   *
   * The drawn head carries the only way back on these screens, so on the first
   * step it cannot simply be absent: a person who opened the wizard by mistake
   * would have nothing to press. It leaves for the host's own landing, which
   * is the declared parent of this route, rather than calling history back.
   */
  const leave = useBack("/host");

  /*
   * UNSAVED CHANGES ARE ASKED ABOUT, NEVER LOST.
   *
   * Back, a jump along the progress path, a row's chevron, a link out of the
   * wizard, reloading and closing the tab all go through `attempt`, which asks
   * when the step (or a typed field) has anything not yet saved: Save and go
   * back, Discard, or Stay. A browser leaving the page gets the browser's own
   * prompt (`beforeunload`), which is the only one a page may show there.
   * The browser's Back button gets this prompt too: `useBackGuard` holds one
   * history entry while anything is unsaved, so Back takes that entry off
   * and the wizard asks (docs/BACK_NAVIGATION.md, "Unsaved changes").
   */
  const textDirty = draft.businessId
    ? differs(pickText(draft), savedText)
    : TEXT_FIELDS.some((key) => (draft[key] ?? "").trim().length > 0);
  const isDirty = () => textDirty || memory.dirty();
  const [leaving, setLeaving] = useState<Leave | null>(null);
  const [savingLeave, setSavingLeave] = useState(false);

  const perform = (target: Leave) => {
    setNotice(null);
    if (target.kind === "jump") {
      setAt(Math.max(0, Math.min(steps.length - 1, target.index)));
      return;
    }
    if (target.kind === "link") {
      if (/^https?:/i.test(target.href) && !target.href.startsWith(window.location.origin)) {
        window.location.assign(target.href);
      } else {
        router.push(target.href);
      }
      return;
    }
    if (target.kind === "history" || at === 0) {
      /* Leave the way the person came in (the Create sheet, the host
         landing), not by stacking a second `/host` on top. Only once the
         prompt's own history entry is off: walking back while it is still
         on top landed one screen too far back. */
      whenSheetsClosed(leave);
      return;
    }
    setAt((i) => Math.max(0, i - 1));
  };
  const attempt = (target: Leave) => {
    setNotice(null);
    if (isDirty()) setLeaving(target);
    else perform(target);
  };
  const back = () => attempt({ kind: "back" });
  const jumpTo = (index: number) => attempt({ kind: "jump", index });
  /* The browser's Back, which only reaches here while something is unsaved. */
  useBackGuard(isDirty(), () => {
    setNotice(null);
    setLeaving({ kind: "history" });
  });

  const discardAndGo = () => {
    const target = leaving;
    memory.forget(step.id);
    setDraft((current) => {
      const reverted = { ...current, ...savedText };
      const keep: LocalDraft = {};
      for (const key of ["hostType", "kind", ...TEXT_FIELDS] as const) {
        (keep as Record<string, unknown>)[key] = reverted[key];
      }
      writeLocal(keep);
      return reverted;
    });
    setLeaving(null);
    if (target) perform(target);
  };
  const saveAndGo = async () => {
    const target = leaving;
    setSavingLeave(true);
    const textSaved = textDirty ? await saveTextAsync() : true;
    const saved = textSaved && (await memory.saveAll());
    setSavingLeave(false);
    if (!saved) return;
    memory.forget(step.id);
    setLeaving(null);
    if (target) perform(target);
  };

  /* The browser's own leave prompt, and links anywhere on the page. A link
     click is caught on the way down (capture), before Next's router sees it. */
  const dirtyNow = useRef(isDirty);
  useEffect(() => {
    dirtyNow.current = isDirty;
  });
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyNow.current()) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      const sameOrigin = url.origin === window.location.origin;
      if (sameOrigin && url.pathname === window.location.pathname && url.search === window.location.search) return;
      if (!dirtyNow.current()) return;
      event.preventDefault();
      event.stopPropagation();
      setLeaving({ kind: "link", href: sameOrigin ? `${url.pathname}${url.search}${url.hash}` : url.href });
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  /** What Next does on each step: save what the step holds, then move. */
  const next = () => {
    switch (step.id) {
      case "host-type":
        forward();
        return;
      case "business":
      case "registration":
      case "representative":
        saveText({}, forward);
        return;
      default:
        forward();
    }
  };

  const canAdvance = (() => {
    switch (step.id) {
      case "host-type":
        return draft.hostType !== null && draft.kind !== null;
      case "business":
        return (agreed || agreeNow) && (payAgreed || payNow) && BUSINESS_SECTIONS.every((section) =>
          section.fields.every(
            (field) => field.optional || (draft[field.name as TextKeys] ?? "").trim().length > 0,
          ),
        );
      case "consent":
        return CONSENTS.every((c) => Boolean(draft.consents[c.id]));
      default:
        return true;
    }
  })();

  if (submitted) return <Sent businessName={draft.name} />;

  /*
   * THE HEAD IS THE RENDER'S, FOR EVERY STEP AND NOT ONLY THE DRAWN ONES.
   *
   * `GOVERNING-09` through `GOVERNING-11` draw one head on every stays screen:
   * the way back at the left, the progress segments on the SAME LINE beside
   * it, then the question in display type and one sentence under it. What was
   * here was a "Step 4 of 9" caption over a full width bar, with Back at the
   * very bottom of the page under the fold. Two heads in one flow would be
   * worse than either, so the drawn one is used throughout.
   *
   * THE SEGMENT COUNT IS `steps.length` AND NEVER THE RENDER'S FOUR. Each
   * image shows a four-screen set-up; the real application also asks for an
   * identity document, a payout account and three consents. Drawing four
   * segments would promise a shorter flow than the person is going to get.
   */
  const drawn = DRAWN_STAYS_STEPS.has(step.id);
  const applied = successCopy(successWords, "hostApplied");

  return (
    <div>
      <SuccessSheet
        open={celebrate}
        onOpenChange={setCelebrate}
        variant={applied.variant}
        object={applied.object}
        title={applied.title}
        body={applied.body}
        primary={{ label: successWords.continue }}
      />
      <Sheet
        open={leaving !== null}
        onOpenChange={(open) => {
          if (!open && !savingLeave) setLeaving(null);
        }}
        title={hw.wizard.unsavedTitle}
        card
        detents={[0.6]}
      >
        <div className="flex flex-col gap-md p-md" data-testid="unsaved-prompt">
          <p className={TYPE.body}>
            {hw.wizard.unsavedBody}
          </p>
          {notice?.tone === "error" && (
            <p role="alert" className="nf-body-sm text-[var(--nf-state-error)]">
              {notice.text}
            </p>
          )}
          <Button variant="primary" size="lg" full loading={savingLeave} disabled={savingLeave} onClick={() => void saveAndGo()}>
            {leaving?.kind === "back" || leaving?.kind === "history" ? hw.wizard.saveAndGoBack : hw.wizard.saveAndGo}
          </Button>
          <Button variant="secondary" size="lg" full disabled={savingLeave} onClick={discardAndGo}>
            {hw.wizard.discard}
          </Button>
          <Button variant="quiet" size="lg" full disabled={savingLeave} onClick={() => setLeaving(null)}>
            {hw.wizard.stay}
          </Button>
        </div>
      </Sheet>
      <StaysHead
        /*
         * `GOVERNING-11` screen three is the one drawn screen whose heading is
         * beside the glass object rather than over the fields, so the panel
         * draws its own and the head draws only the way back and the segments.
         */
        title={step.id === "restaurant" ? undefined : step.title}
        hint={step.id === "restaurant" ? undefined : step.hint}
        steps={steps.length}
        current={at + 1}
        label={progressLabel(at, steps.length)}
        onBack={back}
      />

      {/* SENT BACK BY A REVIEWER. The host page says "open the application to
          answer", so the question has to be here, on every step, in the
          reviewer's own words. Before this the wizard never mentioned it. */}
      {(draft.status === "MORE_INFO_REQUIRED" || draft.status === "REJECTED") && (
        <section
          className="nf-panel nf-panel--card block nf-host-group mt-md"
          role="status"
          data-testid="host-sent-back"
        >
          {/* The host page's own words for this state and this note, so the
              two screens say the same thing. */}
          <h2 className="nf-host-group__title">
            {draft.status === "REJECTED"
              ? hostPage.businessStatus.REJECTED
              : hostPage.businessStatus.MORE_INFO_REQUIRED}
          </h2>
          <p className="nf-host-group__note whitespace-pre-wrap">
            {draft.reviewNotes
              ? hostPage.home.reviewerWrote.replace("{note}", draft.reviewNotes)
              : hostPage.home.noReason}
          </p>
          <p className="mt-2xs nf-caption">
            {draft.status === "REJECTED"
              ? hw.wizard.resubmitRejected
              : hw.wizard.resubmitMore}
          </p>
        </section>
      )}

      {/* THE PROGRESS PATH (reference 7110), the same one the agent's listing
          wizard carries: every step on one path, done ones a tap away, folded
          under the head so the step stays the subject. It shows the steps this
          host will be asked for (`steps`, the same list the segments count) in
          their own words, and says the autosave only as far as it is true: the
          device keeps the typed fields from the start, the account from the
          business step on. The steps and the rail are unchanged (D28). */}
      {steps.length > 1 ? (
        <Unfold
          className="mt-md"
          headingLevel={2}
          items={[
            {
              id: "path",
              icon: "clipboard-list",
              title: pathWords.allSteps,
              hint: [
                pathWords.stepOf.replace("{n}", String(at + 1)).replace("{total}", String(steps.length)),
                draft.businessId ? pathWords.savedHost : pathWords.savedDevice,
                /* Two sentences, the first with no full stop of its own ("Step 1 of 11"):
                   a plain space ran them together as "Step 1 of 11 Saved on this device". */
              ].join(" · "),
              content: (
                <ProgressPath
                  steps={steps.map((s) => ({ id: s.id, label: s.title, tile: HOST_STEP_TILES[s.id] }))}
                  at={at}
                  onJump={jumpTo}
                  disabled={pending}
                  copy={{ done: pathWords.done, current: pathWords.current, upcoming: pathWords.upcoming }}
                  locale={locale}
                />
              ),
            },
          ]}
        />
      ) : null}

      <div className="mt-lg flex flex-col gap-md" key={step.id}>
        <HeldProvider value={memory.value}>
        <StepBody
          step={step.id}
          draft={draft}
          set={set}
          userId={userId}
          policies={policies}
          locale={locale}
          pending={pending}
          fieldErrors={fieldErrors}
          run={run}
          saveText={saveText}
          setNotice={setNotice}
          expectedRooms={expectedRooms}
          onExpectedRooms={setExpectedRooms}
          advance={forward}
          proceed={() => attempt({ kind: "jump", index: at + 1 })}
          runAsync={runAsync}
          saveTextAsync={saveTextAsync}
          arrivalCopy={arrivalCopy}
          agreed={agreed}
          agreeNow={agreeNow}
          onAgree={setAgreeNow}
          payAgreed={payAgreed}
          payNow={payNow}
          onPay={setPayNow}
          acceptCopy={acceptCopy}
          goTo={(id) => {
            const index = steps.findIndex((s) => s.id === id);
            if (index >= 0) jumpTo(index);
          }}
        />
        </HeldProvider>
      </div>

      {notice && (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={`mt-md nf-body-sm ${notice.tone === "error" ? "text-[var(--nf-state-error)]" : "text-[var(--nf-state-success)]"}`}
        >
          {notice.text}
        </p>
      )}
      <PhoneGateLink show={notice?.phoneGate === true} full className="mt-sm" />

      {/*
        THE FOOT IS ONLY FOR THE STEPS THAT ARE NOT DRAWN. Every drawn panel
        ends in its own Continue, inside the screen, because that is where the
        render puts it and because a save and an advance are one act to the
        person pressing it. Drawing a second forward control under one of them
        would be two buttons for one intention.
      */}
      {!drawn && (
        <div className="nf-host-foot">
          {step.id !== "review" && (
            <Button
              variant="primary"
              size="lg"
              full
              trailingIcon="chevron-right"
              onClick={next}
              disabled={!canAdvance || pending}
              loading={pending}
            >
              {hw.wizard.continue}
            </Button>
          )}
        </div>
      )}
      <p className="nf-host-saved">
        <UiIcon name="verified" size={12} />
        {draft.businessId ? hw.wizard.savedAsYouGo : hw.wizard.keptOnDevice}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- the steps */

type StepProps = {
  step: HostStepId;
  draft: HostDraft;
  set: <K extends keyof HostDraft>(key: K, value: HostDraft[K]) => void;
  userId: string;
  policies: PolicyOption[];
  locale: Locale;
  pending: boolean;
  fieldErrors: Record<string, string>;
  run: (work: () => Promise<ActionResult<unknown>>, then?: (data: unknown) => void) => void;
  saveText: (extra?: Record<string, unknown>, then?: () => void) => void;
  setNotice: (notice: Notice) => void;
  goTo: (id: HostStepId) => void;
  /** Move on after a save. Every drawn panel owns its own Continue and calls this. */
  advance: () => void;
  /** Move on without saving, asking first if anything is unsaved. */
  proceed: () => void;
  runAsync: (work: () => Promise<ActionResult<unknown>>) => Promise<boolean>;
  saveTextAsync: (extra?: Record<string, unknown>) => Promise<boolean>;
  arrivalCopy?: Dictionary["afterTheGate"]["arrival"];
  /** The host's agreement: already on record, or ticked on this visit. */
  agreed: boolean;
  agreeNow: boolean;
  onAgree: (next: boolean) => void;
  /** Ruling 6: the pay-on-Vallo statement, on record or ticked on this visit. */
  payAgreed: boolean;
  payNow: boolean;
  onPay: (next: boolean) => void;
  acceptCopy?: Pick<Dictionary["payChoice"], "accept">;
  /** The hotel's stated total, held by the wizard. See its declaration. */
  expectedRooms: number;
  onExpectedRooms(next: number): void;
};

/**
 * THE EIGHT STEPS `GOVERNING-10` AND `GOVERNING-11` DRAW.
 *
 * A set rather than a list of cases, because two things have to agree about
 * it: `StepBody` renders the drawn panel, and the wizard's foot must NOT then
 * draw a second forward control under a panel that already has one.
 */
const DRAWN_STAYS_STEPS = new Set<HostStepId>([
  "hotel",
  "room-types",
  "rates",
  "place",
  "house-rules",
  "facilities",
  "extra-charges",
  "restaurant",
  "tables",
]);

function StepBody(props: StepProps) {
  switch (props.step) {
    case "host-type":
      return <HostTypeStep {...props} />;
    case "business":
      return (
        <>
          <BusinessStep {...props} />
          <HostAgreementTick agreed={props.agreed} agreeNow={props.agreeNow} onAgree={props.onAgree} />
          {props.payAgreed ? null : (
            <WorkspaceAcceptance
              className="nf-host-group"
              copy={props.acceptCopy ?? PAY_ON_VALLO_FALLBACK}
              showTerms={false}
              terms
              pay={props.payNow}
              onTerms={() => undefined}
              onPay={props.onPay}
            />
          )}
        </>
      );
    case "registration":
      return <RegistrationStep {...props} />;
    case "representative":
      return <RepresentativeStep {...props} />;
    case "hotel":
      return <HotelStep {...props} />;
    case "room-types":
      return <RoomTypesStep {...props} />;
    case "rates":
      return <RatesStep {...props} />;
    case "place":
      return <PlaceStep {...props} />;
    case "house-rules":
      return <HouseRulesStep {...props} />;
    case "facilities":
      return <FacilitiesStep {...props} />;
    case "extra-charges":
      return <ExtraChargesStep {...props} copy={props.arrivalCopy} />;
    case "restaurant":
      /* The photographs and the health permit sit ABOVE the step's Continue:
         both are on `missingFrom`'s list, and the permit used to be drawn
         under the button, where a host who pressed Continue never saw it. */
      return (
        <RestaurantStep
          {...props}
          extra={
            <>
              <VenuePhotos {...props} />
              <HygieneAttestation {...props} />
            </>
          }
        />
      );
    case "tables":
      return <TablesStep {...props} />;
    case "payout":
      return <PayoutStep {...props} />;
    case "consent":
      return <ConsentStep {...props} />;
    case "review":
      return <ReviewStep {...props} />;
  }
}

function HostTypeStep({ draft, set }: StepProps) {
  const hw = useHostCopy();
  const chosen = draft.hostType ? HOST_TYPE_DEFINITIONS[draft.hostType] : null;
  return (
    <>
      <div role="radiogroup" aria-label={hw.wizard.hostKindLabel} className="flex flex-col gap-xs">
        {HOST_TYPES.map((type) => {
          const definition = HOST_TYPE_DEFINITIONS[type];
          const on = draft.hostType === type;
          return (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={on}
              className="nf-panel nf-panel--card nf-host-choice"
              onClick={() => {
                set("hostType", type);
                /* A restaurant is a restaurant; the other branches pick. */
                set("kind", type === "restaurant" ? "restaurant" : definition.kinds.includes(draft.kind as BusinessKind) ? draft.kind : null);
              }}
            >
              {/* The stays door's 3D render (`GOVERNING-09` screen three), on
                  the same plate the learning path's tiles stand on. */}
              <span className="nf-path__tile" aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element -- a 256px render at 48px */}
                <img src={HOST_TYPE_TILES[type]} alt="" width={48} height={48} decoding="async" />
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block ${TYPE.rowTitle}`}>{definition.title}</span>
                <span className={`block ${TYPE.rowMeta}`}>{definition.meaning}</span>
              </span>
              <span className="nf-host-choice__ring" aria-hidden="true">
                {on && <UiIcon name="verified" size={16} />}
              </span>
            </button>
          );
        })}
      </div>
      {chosen && chosen.kinds.length > 1 && (
        <div className="nf-panel nf-panel--card block nf-host-group">
          <p className="nf-host-group__title">{hw.wizard.exactKind}</p>
          <div className="mt-sm flex flex-wrap gap-xs" role="group" aria-label={hw.wizard.businessKindLabel}>
            {chosen.kinds.map((kind) => (
              /* The raw chip, on purpose: `Chip`'s selected state is the lit CTA
                 gradient with a bloom, and a filter row is not where a screen's
                 one glow goes. `nf-chip--active` is the calm brand tint. */
              <button
                key={kind}
                type="button"
                aria-pressed={draft.kind === kind}
                className={`nf-chip${draft.kind === kind ? " nf-chip--active" : ""}`}
                onClick={() => set("kind", kind)}
              >
                {hw.wizard.kinds[kind]}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/** The pay-on-Vallo tick's English, for a caller that hands no dictionary (the dev previews). */
const PAY_ON_VALLO_FALLBACK: Pick<Dictionary["payChoice"], "accept"> = {
  accept: {
    title: "Before you send this",
    termsLead: "I have read and accept the",
    termsLink: "Terms of Service",
    and: "and the",
    privacyLink: "Privacy Policy",
    newTab: "opens in a new tab",
    payInside: "Every payment for a deal I make on Vallo happens inside Vallo.",
    required: "Tick both boxes to send this.",
    done: "You accepted the Terms of Service and the Privacy Policy, and that every payment for a deal happens inside Vallo.",
  },
};

/**
 * THE TERMS, THE PRIVACY POLICY AND THE HOST AGREEMENT, agreed before the
 * business is created. Each opens in a new tab; the tick is recorded with the
 * moment and the three versions on the save that creates the business.
 */
function HostAgreementTick({
  agreed,
  agreeNow,
  onAgree,
}: {
  agreed: boolean;
  agreeNow: boolean;
  onAgree: (next: boolean) => void;
}) {
  const w = useHostCopy().wizard;
  /* The sentence with its three links where the words put them, so a
     translation owns the order. */
  const LINKS: Record<string, { href: string; label: string }> = {
    terms: { href: "/terms", label: w.termsLink },
    privacy: { href: "/privacy", label: w.privacyLink },
    agreement: { href: "/host-agreement", label: w.agreementLink },
  };
  return (
    <section className="nf-panel nf-panel--card block nf-host-group" data-testid="host-agreement">
      {agreed ? (
        <p className="nf-host-group__note">{w.agreed}</p>
      ) : (
        <label className="flex items-start gap-sm">
          <input
            type="checkbox"
            className="mt-3xs h-5 w-5 shrink-0"
            checked={agreeNow}
            onChange={(event) => onAgree(event.target.checked)}
          />
          <span className={TYPE.body}>
            {w.agreeText.split(/(\{terms\}|\{privacy\}|\{agreement\})/).map((part, i) => {
              const link = LINKS[part.slice(1, -1)];
              return link && part.startsWith("{") ? (
                <Link key={i} href={link.href} target="_blank" className="text-[var(--nf-content-link)] underline">
                  {link.label}
                </Link>
              ) : (
                part
              );
            })}
          </span>
        </label>
      )}
    </section>
  );
}

function BusinessStep({ draft, set, fieldErrors }: StepProps) {
  return (
    <>
      {BUSINESS_SECTIONS.map((section) => (
        <section key={section.heading} className="nf-panel nf-panel--card block nf-host-group">
          <h2 className="nf-host-group__title">{section.heading}</h2>
          <p className="nf-host-group__note">{section.note}</p>
          <div className="mt-md flex flex-col gap-sm">
            {section.fields.map((field) => {
              const key = field.name as TextKeys;
              const value = draft[key] ?? "";
              const error = fieldErrors[field.name];
              if (field.type === "textarea") {
                return (
                  <TextArea
                    key={field.name}
                    label={field.label}
                    hint={field.hint}
                    error={error}
                    optionalText={field.optional ? "(optional)" : undefined}
                    value={value}
                    onChange={(event) => set(key, event.target.value)}
                  />
                );
              }
              return (
                <TextField
                  key={field.name}
                  label={field.label}
                  hint={field.hint}
                  error={error}
                  optionalText={field.optional ? "(optional)" : undefined}
                  type={field.type ?? "text"}
                  value={value}
                  onChange={(event) => set(key, event.target.value)}
                  autoComplete={field.type === "tel" ? "tel" : field.type === "email" ? "email" : undefined}
                />
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}

function RegistrationStep({ draft, set, userId, fieldErrors }: StepProps) {
  const hw = useHostCopy();
  return (
    <>
      <section className="nf-panel nf-panel--card block nf-host-group">
        <h2 className="nf-host-group__title">{hw.wizard.cacTitle}</h2>
        <div className="mt-md flex flex-col gap-sm">
          <TextField
            label={hw.wizard.businessName}
            value={draft.registeredName}
            error={fieldErrors.registeredName}
            onChange={(event) => set("registeredName", event.target.value)}
          />
          <TextField
            label={hw.wizard.rcNumber}
            hint={hw.wizard.rcHint}
            value={draft.cacNumber}
            error={fieldErrors.cacNumber}
            onChange={(event) => set("cacNumber", event.target.value)}
          />
          <TextField
            label={hw.wizard.tin}
            optionalText={hw.wizard.ifYouHaveOne}
            value={draft.tin}
            error={fieldErrors.tin}
            onChange={(event) => set("tin", event.target.value)}
          />
        </div>
      </section>
      <HostDocumentUploader
        kind="registration"
        businessId={draft.businessId}
        userId={userId}
        present={Boolean(draft.documents.registration)}
        onFiled={(kind) => set("documents", { ...draft.documents, [kind]: true })}
      />
    </>
  );
}

function RepresentativeStep({ draft, set, userId, fieldErrors }: StepProps) {
  const hw = useHostCopy();
  const filed = (kind: HostDocumentKind) => set("documents", { ...draft.documents, [kind]: true });
  return (
    <>
      <section className="nf-panel nf-panel--card block nf-host-group">
        <h2 className="nf-host-group__title">{hw.wizard.youTitle}</h2>
        <div className="mt-md flex flex-col gap-sm">
          <TextField
            label={hw.wizard.fullName}
            hint={hw.wizard.nameHint}
            value={draft.representativeName}
            error={fieldErrors.representativeName}
            onChange={(event) => set("representativeName", event.target.value)}
            autoComplete="name"
          />
          <TextField
            label={hw.wizard.phone}
            type="tel"
            value={draft.representativePhone}
            error={fieldErrors.representativePhone}
            onChange={(event) => set("representativePhone", event.target.value)}
            autoComplete="tel"
          />
        </div>
      </section>
      <HostDocumentUploader
        kind="identity"
        businessId={draft.businessId}
        userId={userId}
        present={Boolean(draft.documents.identity)}
        onFiled={filed}
      />
      {draft.hostType === "business" && (
        <HostDocumentUploader
          kind="association"
          businessId={draft.businessId}
          userId={userId}
          present={Boolean(draft.documents.association)}
          onFiled={filed}
        />
      )}
    </>
  );
}

/**
 * THE HEALTH PERMIT ATTESTATION.
 *
 * It lived at the foot of the old "Service and seating" step, which
 * `GOVERNING-11` replaces with two screens that do not draw it. It could not
 * simply go: `missingFrom` refuses to submit a restaurant without it, so
 * deleting the control would have left every restaurant application
 * unsubmittable, which is the exact shape of the defect this build has spent
 * the week removing. It sits under "Your restaurant", which is the screen
 * about the venue rather than the screen about its week.
 */
/**
 * THE RESTAURANT'S PHOTOGRAPHS, ON ITS OWN STEP.
 *
 * `missingFrom` refuses to send a restaurant with no photograph (SUP-17), and
 * nothing in the wizard could upload one: the review step listed "At least one
 * photo of the restaurant" with no way to meet it short of finding
 * `/host/photos` by accident. The manager is the one `/host/photos` draws, on
 * the business spine, and `addBusinessPhoto` gates on ownership rather than on
 * the application being editable, so the photographs can also arrive later.
 */
function VenuePhotos({ draft, userId }: StepProps) {
  if (!draft.businessId) return null;
  return (
    <BusinessPhotoManager businessId={draft.businessId} userId={userId} photos={draft.businessPhotos} />
  );
}

function HygieneAttestation({ draft, pending, saveText }: StepProps) {
  const w = useHostCopy().wizard;
  return (
    <section className="nf-stays-plate">
      <span className="nf-stays-plate__label">{w.hygieneTitle}</span>
      <label className="mt-sm flex items-start gap-sm">
        <input
          type="checkbox"
          className="mt-3xs h-5 w-5"
          checked={Boolean(draft.hygieneAttestedAt)}
          disabled={pending}
          onChange={(e) => saveText({ hygieneAttested: e.target.checked })}
        />
        <span className={TYPE.body}>{w.hygieneBody}</span>
      </label>
      {draft.hygieneAttestedAt && (
        <p className="nf-stays-plate__note">{w.hygieneDone}</p>
      )}
    </section>
  );
}

function PayoutStep({ draft, pending, runAsync, setNotice, set }: StepProps) {
  const hw = useHostCopy();
  const [banks, setBanks] = useState<{ code: string; name: string }[] | null>(null);
  const [banksError, setBanksError] = useState<string | null>(null);
  /* Held in the wizard, so Back keeps a typed account number; an account
     typed and not saved is asked about before the host leaves. */
  const [bank, setBank] = useHeld("bank", "");
  const [number, setNumber] = useHeld("number", "");
  const [resolved, setResolved] = useHeld<string | null>("resolved", null);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    let live = true;
    void listBanks().then((result) => {
      if (!live) return;
      if (result.ok) setBanks(result.data.map((b) => ({ code: b.code, name: b.name })));
      else setBanksError(result.error);
    });
    return () => {
      live = false;
    };
  }, []);

  const resolve = async () => {
    setResolving(true);
    setResolved(null);
    const result = await resolveBankAccount({ bankCode: bank, accountNumber: number });
    setResolving(false);
    if (!result.ok) {
      setNotice({ tone: "error", text: result.error, phoneGate: result.gate === "phone" });
      return;
    }
    setResolved(result.data.accountName);
  };

  /* V-81: a new account to be paid into asks for the phone lock, when there is one. */
  const lockWords = useScopedCopy("moneyLock");
  const lock = useMoneyStepUp();
  const saveAsync = async () => {
    if (!resolved) {
      setNotice({ tone: "error", text: hw.wizard.checkFirst });
      return false;
    }
    const saved = await runAsync(async () => {
      const result = await lock.guard({ kind: "bank_add", target: `${bank}:${number.replace(/\D/g, "")}` }, (stepUp) =>
        addBankAccount({ bankCode: bank, accountNumber: number, stepUp }),
      );
      return result ?? { ok: false as const, error: lockWords.notConfirmed };
    });
    if (saved) {
      set("hasBankAccount", true);
      setBank("");
      setNumber("");
      setResolved(null);
      setNotice({ tone: "ok", text: hw.wizard.accountSaved });
    }
    return saved;
  };
  const save = () => void saveAsync();
  useGuard("account", number.trim().length > 0, saveAsync);

  return (
    <>
      {lock.sheet}
      <section className="nf-panel nf-panel--card block nf-host-group">
        <h2 className="nf-host-group__title">{hw.wizard.payoutsTitle}</h2>
        <p className="nf-host-group__note">
          {draft.hasBankAccount
            ? hw.wizard.accountOnRecord
            : hw.wizard.confirmFirst}
        </p>
        <div className="mt-md flex flex-col gap-sm">
          {banksError ? (
            <p role="status" className="nf-body-sm text-[var(--nf-content-secondary)]">
              {banksError}
            </p>
          ) : (
            <SelectField label={hw.wizard.bank} value={bank} disabled={banks === null} onChange={(e) => { setBank(e.target.value); setResolved(null); }}>
              <option value="">{banks === null ? hw.wizard.loadingBanks : hw.wizard.chooseBank}</option>
              {(banks ?? []).map((b) => (
                <option key={b.code} value={b.code}>
                  {b.name}
                </option>
              ))}
            </SelectField>
          )}
          <TextField
            label={hw.wizard.accountNumber}
            inputMode="numeric"
            maxLength={10}
            value={number}
            onChange={(e) => { setNumber(e.target.value.replace(/\D/g, "")); setResolved(null); }}
          />
          {resolved ? (
            <div className="nf-panel nf-panel--card nf-host-drop nf-host-drop--done">
              <UiIcon name="verified" size={20} className="shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block nf-body-sm font-semibold">{resolved}</span>
                <span className="block nf-caption">{hw.wizard.isThisYou}</span>
              </span>
            </div>
          ) : (
            <Button variant="secondary" onClick={resolve} disabled={!bank || number.length !== 10 || resolving} loading={resolving}>
              {hw.wizard.checkWithBank}
            </Button>
          )}
          {resolved && (
            <Button variant="primary" size="lg" full onClick={save} disabled={pending} loading={pending}>
              {hw.wizard.saveAccount}
            </Button>
          )}
        </div>
      </section>
    </>
  );
}

function ConsentStep({ draft, pending, saveText, set }: StepProps) {
  const hw = useHostCopy();
  const toggle = (id: ConsentId, on: boolean) => {
    const consents = { ...draft.consents };
    if (on) consents[id] = new Date().toISOString();
    else delete consents[id];
    set("consents", consents);
    /* Unticking a consent that was given withdraws it: the withdrawal is
       recorded with its moment, and the application cannot be sent until it
       is given again. */
    saveText(on ? { consents: [id] } : { withdrawConsents: [id] });
  };
  return (
    <div className="flex flex-col gap-xs" role="group" aria-label={hw.wizard.permissionsLabel}>
      {CONSENTS.map((consent) => {
        const on = Boolean(draft.consents[consent.id]);
        return (
          <label key={consent.id} className="nf-panel nf-panel--card nf-host-choice" aria-checked={on} role="checkbox">
            <input
              type="checkbox"
              className="sr-only"
              checked={on}
              disabled={pending}
              onChange={(e) => toggle(consent.id, e.target.checked)}
            />
            <span className="min-w-0 flex-1">
              <span className={`block ${TYPE.rowTitle}`}>{consent.label}</span>
              <span className={`block ${TYPE.rowMeta}`}>{consent.detail}</span>
              {consent.id === "terms" && (
                <span className="mt-2xs flex gap-sm nf-caption">
                  <Link href="/terms" target="_blank" className="text-[var(--nf-content-link)] underline">{hw.wizard.hostTerms}</Link>
                  <Link href="/privacy" target="_blank" className="text-[var(--nf-content-link)] underline">{hw.wizard.privacyPolicy}</Link>
                </span>
              )}
            </span>
            <span className="nf-host-choice__ring" aria-hidden="true">
              {on && <UiIcon name="verified" size={16} />}
            </span>
          </label>
        );
      })}
    </div>
  );
}

function ReviewStep({ draft, pending, run, goTo, set, locale }: StepProps) {
  const hw = useHostCopy();
  const hostPage = useHostPageCopy();
  const missing = missingFrom(draft);
  const send = () =>
    run(
      () => submitHostApplication(),
      () => set("status", "SUBMITTED"),
    );
  const accommodation = hostsAccommodation(draft.hostType ?? "individual");
  return (
    <>
      <section className="nf-panel nf-panel--card block nf-host-group">
        <h2 className="nf-host-group__title">{draft.name || hw.wizard.yourBusiness}</h2>
        <p className="nf-host-group__note">
          {draft.hostType ? HOST_TYPE_DEFINITIONS[draft.hostType].title : hw.wizard.hostTypeMissing}
          {draft.kind ? `, ${hw.wizard.kinds[draft.kind]}` : ""}
        </p>
        <dl className="mt-sm">
          <Fact label={hw.wizard.review.contact} value={[draft.phone, draft.email].filter(Boolean).join(", ")} onEdit={() => goTo("business")} />
          <Fact label={hw.wizard.review.address} value={[draft.address, draft.area, draft.city, draft.stateCode].filter(Boolean).join(", ")} onEdit={() => goTo("business")} />
          {draft.hostType === "business" && (
            <Fact label={hw.wizard.review.registration} value={[draft.registeredName, draft.cacNumber].filter(Boolean).join(", ")} onEdit={() => goTo("registration")} />
          )}
          <Fact label={hw.wizard.review.representative} value={[draft.representativeName, draft.representativePhone].filter(Boolean).join(", ")} onEdit={() => goTo("representative")} />
          {accommodation ? (
            <Fact
              label={hw.wizard.review.property}
              value={draft.accommodation ? `${draft.accommodation.name}, ${countOf(draft.roomTypeCount, "roomTypes", locale)}, ${countOf(draft.ratePlanCount, "ratePlans", locale)}` : ""}
              /* The property's first drawn screen, whichever branch this
                 host is on: a hotelier lands on "Your hotel" and a shortlet
                 operator on "Your place". */
              onEdit={() => goTo(branchFor(draft.kind) === "shortlet" ? "place" : "hotel")}
            />
          ) : (
            <Fact label={hw.wizard.review.service} value={draft.serviceWindowCount > 0 ? countOf(draft.serviceWindowCount, "windows", locale) : ""} onEdit={() => goTo("tables")} />
          )}
          {/* The photographs are a requirement on both spines and live on a
              different step from the property's name, so they get their own
              row and their own way back to where they are added. */}
          <Fact
            label={hostPage.businessDoors.photos}
            value={(() => {
              const count = accommodation ? (draft.accommodation?.photos.length ?? 0) : draft.businessPhotoCount;
              return count > 0 ? countOf(count, "photos", locale) : "";
            })()}
            onEdit={() => goTo(accommodation ? "facilities" : "restaurant")}
          />
          <Fact label={hw.wizard.review.payouts} value={draft.hasBankAccount ? hw.wizard.bankOnRecord : ""} onEdit={() => goTo("payout")} />
        </dl>
      </section>

      <section className="nf-panel nf-panel--card block nf-host-group" aria-live="polite">
        <h2 className="nf-host-group__title">
          {missing.length === 0 ? hw.wizard.everythingHere : hw.wizard.stillMissing.replace("{count}", String(missing.length))}
        </h2>
        {missing.length > 0 ? (
          <ul className="mt-xs">
            {missing.map((item) => (
              <li key={item} className="nf-host-missing">
                <UiIcon name="close" size={16} className="mt-3xs shrink-0 text-[var(--nf-state-error)]" />
                {item}
              </li>
            ))}
          </ul>
        ) : (
          <p className="nf-host-group__note">{hw.wizard.teamReads}</p>
        )}
      </section>

      <Button variant="primary" size="lg" full onClick={send} disabled={pending || missing.length > 0} loading={pending}>
        {draft.status === "REJECTED" || draft.status === "MORE_INFO_REQUIRED" ? hw.wizard.sendAgain : hw.wizard.sendForReview}
      </Button>
    </>
  );
}

function Fact({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  const w = useHostCopy().wizard;
  return (
    <div className="nf-host-missing">
      <dt className="w-28 shrink-0 nf-caption font-semibold">{label}</dt>
      <dd className="min-w-0 flex-1">{value || <span className="text-[var(--nf-content-muted)]">{w.notGiven}</span>}</dd>
      <Button variant="quiet" size="sm" onClick={onEdit}>
        {w.edit}
      </Button>
    </div>
  );
}

function Sent({ businessName }: { businessName: string }) {
  const w = useHostCopy().wizard;
  return (
    <div className="flex flex-col items-center px-lg py-section text-center">
      <span className="grid size-[5.5rem] shrink-0 place-items-center" aria-hidden="true" data-art="calendar-pending">
        <Icon3D name="calendar-pending" size={88} />
      </span>
      <p className={`mt-block ${TYPE.sectionTitle}`}>{w.sentTitle.replace("{name}", businessName || w.yourApplication)}</p>
      <p className={`mt-inline max-w-[42ch] ${TYPE.body}`}>
        {w.sentBody}
      </p>
      <Link href="/host" className="nf-btn nf-btn--primary nf-btn--lg mt-block">
        {w.hostPage}
      </Link>
    </div>
  );
}
