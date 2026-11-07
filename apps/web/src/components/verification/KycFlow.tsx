"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { StepFrame } from "@/components/ui/StepFrame";
import { TextField } from "@/components/ui/Field";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { ICON_PLATE_GLYPH, IconPlate } from "@/components/ui/IconPlate";
import { Icon3D } from "@/components/ui/Icon3D";
import type { Icon3DName } from "@/components/ui/icon-3d";
import { DocumentUploader } from "./DocumentUploader";
import { SelfieCapture } from "./SelfieCapture";
import { SuccessSheet } from "@/components/ui/SuccessSheet";
import { successCopy, type SuccessWords } from "@/lib/ui/success-moments";
import type { Dictionary } from "@vallo/i18n/core";
import { WorkspaceAcceptance } from "@/components/legal/WorkspaceAcceptance";

/** The flow's words (`experienceAccount.kyc`), from the server page (Round 3 sweep, C3). */
export type KycCopy = Dictionary["experienceAccount"]["kyc"];
import {
  BUSINESS_SECTIONS,
  CONSENTS,
  addressDateIssue,
  isSubtypeOf,
  lagosToday,
  missingItems,
  stepsFor,
  type MissingItem,
  type ConsentId,
  type DocumentKind,
  type KycDocument,
  type KycSelfie,
  type KycSubmission,
  type KycSubmitResult,
  type StepId,
} from "./kyc";

/**
 * The verification flow.
 *
 * SIX SCREENS AT MOST AND ONE TASK ON EACH. The header of every step carries
 * three things and only three: where you are ("Step 4 of 6") drawn as a
 * segmented bar you can count, a back control that is always present after the
 * first step, and the single question this step is asking. A step that asks two
 * questions is two steps.
 *
 * WHY THE STEP COUNT IS NOT A CONSTANT. The flow branches on whether the person
 * runs a property business, so somebody who says yes sees six steps and
 * somebody who says no sees five. `stepsFor` in `kyc.ts` owns that and this
 * component reads the length off it, which is why the progress bar grows by one
 * segment the instant the answer changes rather than lying in either direction.
 *
 * WHAT THIS COMPONENT DOES NOT KNOW. Where the rows go. `submit` is a prop and
 * the payload is `KycSubmission`; the uploader holds each file's real storage
 * path once it is up, and the server action files it.
 *
 * WHEN SUBMISSION FAILS IT SAYS SO. `submit` returning `{ ok: false }` prints
 * the reason on the review step and leaves every answer where it was. It does
 * NOT show the submitted screen. The submitted screen is a promise that a human
 * is going to look at your passport, and showing it after a failed write is the
 * single worst lie this flow could tell.
 */

export function KycFlow({
  submit,
  success,
  copy,
  flowCopy,
  askBusiness = true,
  acceptCopy,
  payoutHref,
}: {
  /** The flow's words, from the server page. */
  copy: KycCopy;
  /** The Grade 1 intro, eyebrows and Change (`verifyFlow`). */
  flowCopy: Dictionary["verifyFlow"];
  /** The page's `t.success`, for the "Documents sent" sheet. Absent, no sheet. */
  success?: SuccessWords;
  /**
   * Sends the submission. Resolves with `{ ok: true }` only when it is
   * genuinely stored and queued for review.
   */
  submit: (submission: KycSubmission) => Promise<KycSubmitResult>;
  /**
   * Whether the business question is asked at all. The page turns it off
   * when the person's application can no longer take the answers (submitted,
   * under review or decided), because `submitVerification` could only drop
   * them. See `stepsFor`.
   */
  askBusiness?: boolean;
  /**
   * Ruling 6: the Terms, Privacy Policy and pay-on-Vallo ticks, drawn on the
   * consent step when this flow can file or resend a workspace application.
   * Absent, the ticks are not drawn (and the server asks for them only when
   * an application is actually sent).
   */
  acceptCopy?: Pick<Dictionary["payChoice"], "accept">;
  /**
   * Where the person adds the bank account they are paid into, when they
   * have one (listers). The submitted screen names it as the next step: the
   * name on that account is checked against the ID.
   */
  payoutHref?: string;
}) {
  const [at, setAt] = useState(0);
  /* GRADE 1: the intro on the page first; the steps open full screen and
     keep every answer if they are closed. */
  const [opened, setOpened] = useState(false);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [business, setBusiness] = useState<boolean | null>(null);
  const [documents, setDocuments] = useState<Partial<Record<DocumentKind, KycDocument>>>({});
  const [selfie, setSelfie] = useState<KycSelfie | null>(null);
  /* One storage folder per visit, so a replaced photo lands beside the one
     it replaces rather than in a new folder every time. */
  const [batchId] = useState(() => {
    try {
      return crypto.randomUUID();
    } catch {
      return `b-${Date.now()}`;
    }
  });
  const [businessDetails, setBusinessDetails] = useState<Record<string, string>>({});
  const [consents, setConsents] = useState<ConsentId[]>([]);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPay, setAcceptPay] = useState(false);
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const steps = stepsFor(business, askBusiness);
  const step = steps[Math.min(at, steps.length - 1)]!;
  const submission: KycSubmission = {
    documents,
    selfie,
    business: business === true,
    businessDetails,
    consents,
    ...(acceptCopy ? { acceptTerms, acceptPayOnVallo: acceptPay } : {}),
  };

  /* `sent` is set only by the action's own ok, so the sheet opens once, at
     filing, over the "in review" screen it leaves behind. */
  if (sent)
    return (
      <>
        <Submitted copy={copy} payoutHref={payoutHref} />
        {success ? <KycSentSheet copy={success} /> : null}
      </>
    );

  const back = () => {
    setFailure(null);
    setDirection("back");
    setAt((i) => Math.max(0, i - 1));
  };
  const forward = () => {
    setFailure(null);
    setDirection("forward");
    setAt((i) => Math.min(steps.length - 1, i + 1));
  };

  /*
   * Whether THIS step may be left. Deliberately per step rather than one
   * validation at the end: being told on screen six that screen two was
   * incomplete is the thing that makes people abandon a form.
   */
  const canAdvance = (() => {
    switch (step.id) {
      case "identity-document":
        return Boolean(documents.identity) && isSubtypeOf("identity", documents.identity?.subtype);
      case "selfie":
        return Boolean(selfie?.path);
      case "address-document":
        return (
          Boolean(documents.address) &&
          isSubtypeOf("address", documents.address?.subtype) &&
          addressDateIssue(documents.address?.issuedOn, lagosToday()) === null
        );
      case "business-question":
        return business !== null;
      case "business-details":
        return BUSINESS_SECTIONS.every((section) =>
          section.fields.every(
            (field) => field.optional || (businessDetails[field.name] ?? "").trim().length > 0,
          ),
        );
      case "consent":
        return CONSENTS.every((c) => consents.includes(c.id)) && (!acceptCopy || (acceptTerms && acceptPay));
      default:
        return true;
    }
  })();

  async function send() {
    if (sending) return;
    setSending(true);
    setFailure(null);
    let result: KycSubmitResult;
    try {
      result = await submit(submission);
    } catch {
      /* A dropped connection or a deploy between taps throws rather than
         answering. Nothing is lost: every answer is still on this screen. */
      result = { ok: false, message: copy.sendUnreached };
    }
    setSending(false);
    if (result.ok) {
      /* The server revalidates /verification, so the next visit reads "in
         review" rather than an empty form. */
      setSent(true);
      return;
    }
    setFailure(result.message);
  }

  const gaps = missingItems(submission).map((item) => gapWords(item, copy));
  const progress = copy.progress.replace("{n}", String(at + 1)).replace("{total}", String(steps.length));
  const stepWords = copy.steps[step.id];

  /* GRADE 1: the review's Change jumps straight back to that step. */
  const changeTo = (id: StepId) => {
    const index = steps.findIndex((s) => s.id === id);
    if (index < 0) return undefined;
    return { label: flowCopy.change, run: () => { setDirection("back"); setAt(index); } };
  };
  const startedAlready = at > 0 || Boolean(documents.identity) || Boolean(selfie);

  /* ------------------------------------------------- the intro, on the page */
  if (!opened) {
    return (
      <section className="nf-g1-intro" data-testid="kyc-intro" aria-labelledby="kyc-intro-title">
        <span className="nf-g1-intro__art" aria-hidden="true">
          <Icon3D name="id-check" size={64} priority />
        </span>
        <p className="nf-g1step__eyebrow">{flowCopy.introEyebrow}</p>
        <h2 id="kyc-intro-title" className="nf-g1-intro__title">{flowCopy.introTitle}</h2>
        <p className="nf-g1-intro__body">{flowCopy.introBody}</p>
        <p className="nf-g1-intro__need">{flowCopy.introNeedTitle}</p>
        <ul className="nf-g1-intro__list">
          <li><UiIcon name="id-card" size={20} /><span>{flowCopy.introNeedId}</span></li>
          <li><UiIcon name="camera" size={20} /><span>{flowCopy.introNeedSelfie}</span></li>
          <li><UiIcon name="home" size={20} /><span>{flowCopy.introNeedAddress}</span></li>
        </ul>
        <p className="nf-g1-intro__note"><UiIcon name="lock" size={16} /><span>{flowCopy.introPrivacy}</span></p>
        <p className="nf-g1-intro__note"><UiIcon name="clock" size={16} /><span>{flowCopy.introTime}</span></p>
        <Button variant="primary" size="lg" full className="mt-lg" onClick={() => setOpened(true)} data-testid="kyc-start">
          {startedAlready ? flowCopy.introResume : flowCopy.introStart}
        </Button>
      </section>
    );
  }

  /* ---------------------------------- one question per screen, full screen */
  return (
    <StepFrame
      overlay
      testId="kyc-flow"
      step={at + 1}
      total={steps.length}
      stepLabel={progress}
      eyebrow={flowCopy.eyebrows[step.id]}
      title={stepWords.title}
      subtitle={stepWords.hint}
      art={<Icon3D name={STEP_ART[step.id]} size={56} priority />}
      direction={direction}
      onBack={at > 0 ? back : undefined}
      backLabel={copy.back}
      onClose={() => setOpened(false)}
      closeLabel={flowCopy.close}
      primary={
        step.id === "review"
          ? { label: copy.send, onClick: send, loading: sending, disabled: gaps.length > 0, testId: "kyc-send" }
          : { label: copy.continue, onClick: forward, disabled: !canAdvance }
      }
    >
      <div className="space-y-md">
        {step.id === "identity-document" && (
          <DocumentUploader
            kind="identity"
            copy={copy}
            batchId={batchId}
            file={documents.identity ?? null}
            onChange={(file) =>
              setDocuments((d) => ({ ...d, ...(file ? { identity: file } : { identity: undefined }) }))
            }
          />
        )}

        {step.id === "selfie" && (
          <SelfieCapture copy={copy} batchId={batchId} selfie={selfie} onChange={setSelfie} />
        )}

        {step.id === "address-document" && (
          <DocumentUploader
            kind="address"
            copy={copy}
            batchId={batchId}
            file={documents.address ?? null}
            onChange={(file) =>
              setDocuments((d) => ({ ...d, ...(file ? { address: file } : { address: undefined }) }))
            }
          />
        )}

        {step.id === "business-question" && (
          /*
           * The branch. Two rows with a divider, the same shape as the role
           * sheet, because they are the same kind of decision: pick one of
           * these, and one of them is already true of you.
           */
          <ul className="divide-y divide-[var(--nf-divider)]">
            {[
              { value: true, label: copy.businessYes, detail: copy.businessYesDetail },
              { value: false, label: copy.businessNo, detail: copy.businessNoDetail },
            ].map((option) => (
              <li key={String(option.value)}>
                <button
                  type="button"
                  onClick={() => {
                    setBusiness(option.value);
                    /* Answering the question is enough to move on: a
                       confirmation tap after a two-option choice is a tap that
                       exists only to be counted. */
                    setDirection("forward");
                    setAt((i) => i + 1);
                  }}
                  aria-pressed={business === option.value}
                  className="flex w-full items-center gap-sm px-2xs py-md text-left transition-colors hover:bg-[var(--nf-interactive-hover)]"
                >
                  <IconPlate size="md">
                    <UiIcon
                      name={option.value ? "building-apartment" : "user"}
                      size={ICON_PLATE_GLYPH.md}
                    />
                  </IconPlate>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-primary)]">
                      {option.label}
                    </span>
                    <span className="mt-3xs block text-[length:var(--nf-text-caption)] leading-snug text-[var(--nf-content-muted)]">
                      {option.detail}
                    </span>
                  </span>
                  <UiIcon
                    name="chevron-right"
                    size="sm"
                    className="shrink-0 text-[var(--nf-content-muted)]"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}

        {step.id === "business-details" &&
          /*
           * THREE GROUPS, NOT EIGHT BOXES.
           *
           * The reference platform stacks eight identically outlined inputs
           * with nothing between them, and it is the weakest screen in their
           * product: no way to judge how much is left, no way to tell which
           * fields belong together, no way to resume after an interruption
           * except by rereading every label. Each group here is a card with a
           * heading and one line saying why these fields are together, so this
           * is three small tasks rather than one long one.
           */
          BUSINESS_SECTIONS.map((section) => (
            <section key={section.key} className="nf-panel nf-panel--card block p-md sm:p-lg">
              <h2 className="text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-primary)]">
                {copy.sections[section.key].heading}
              </h2>
              <p className="mt-2xs text-[length:var(--nf-text-caption)] text-[var(--nf-content-muted)]">
                {copy.sections[section.key].note}
              </p>

              <div className="mt-md space-y-sm">
                {section.fields.map((field) => (
                  <TextField
                    key={field.name}
                    label={fieldWords(field.name, copy).label}
                    hint={fieldWords(field.name, copy).hint || undefined}
                    type={field.type ?? "text"}
                    required={!field.optional}
                    optionalText={field.optional ? copy.optional : undefined}
                    value={businessDetails[field.name] ?? ""}
                    onChange={(event) =>
                      setBusinessDetails((d) => ({ ...d, [field.name]: event.target.value }))
                    }
                  />
                ))}
              </div>
            </section>
          ))}

        {step.id === "consent" && (
          /*
           * THREE CHECKBOXES, SEPARATELY. One combined "I agree" tick is
           * convenient and is not consent: a statement of fact about the
           * documents, acceptance of a contract, and permission to run identity
           * and fraud checks are three different decisions, and under the NDPA
           * the third has to be specific and freely given.
           */
          <ul className="space-y-sm">
            {CONSENTS.map((consent) => {
              const ticked = consents.includes(consent.id);
              return (
                <li key={consent.id}>
                  <label className="nf-panel nf-panel--card flex-row cursor-pointer items-start gap-sm">
                    <input
                      type="checkbox"
                      checked={ticked}
                      onChange={(event) =>
                        setConsents((list) =>
                          event.target.checked
                            ? [...list, consent.id]
                            : list.filter((id) => id !== consent.id),
                        )
                      }
                      className="mt-3xs h-5 w-5 shrink-0 accent-[var(--nf-brand-primary)]"
                    />
                    <span className="min-w-0">
                      <span className="block text-[length:var(--nf-text-body-sm)] font-semibold leading-snug text-[var(--nf-content-primary)]">
                        {consent.label}
                      </span>
                      <span className="mt-2xs block text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-muted)]">
                        {consent.detail}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        {step.id === "consent" && acceptCopy ? (
          <WorkspaceAcceptance
            copy={acceptCopy}
            terms={acceptTerms}
            pay={acceptPay}
            onTerms={setAcceptTerms}
            onPay={setAcceptPay}
            className="mt-sm"
          />
        ) : null}

        {step.id === "review" && (
          <>
            <ul className="nf-panel nf-panel--card block divide-y divide-[var(--nf-divider)] p-0">
              <ReviewRow label={copy.identityRow} value={documents.identity?.name ?? copy.missing} change={changeTo("identity-document")} />
              <ReviewRow label={copy.selfieRow} value={selfie ? copy.selfieTaken : copy.missing} change={changeTo("selfie")} />
              <ReviewRow label={copy.addressRow} value={documents.address?.name ?? copy.missing} change={changeTo("address-document")} />
              {askBusiness ? <ReviewRow label={copy.businessRow} value={business ? copy.yes : copy.no} change={changeTo("business-question")} /> : null}
              {business &&
                BUSINESS_SECTIONS.flatMap((s) => s.fields).map((field) => (
                  <ReviewRow
                    key={field.name}
                    label={fieldWords(field.name, copy).label}
                    value={businessDetails[field.name]?.trim() || (field.optional ? copy.notGiven : copy.missing)}
                  />
                ))}
            </ul>

            {/* Never "complete all required fields". The gaps are named. */}
            {gaps.length > 0 && (
              <div role="alert" className="nf-panel nf-panel--card block border-[color-mix(in_oklab,var(--nf-state-error)_55%,transparent)]">
                <p className="text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-primary)]">
                  {copy.gapsTitle}
                </p>
                <ul className="mt-xs list-disc space-y-2xs pl-lg text-[length:var(--nf-text-caption)] text-[var(--nf-content-secondary)]">
                  {gaps.map((gap) => (
                    <li key={gap}>{gap}</li>
                  ))}
                </ul>
              </div>
            )}

            {failure && (
              <p role="alert" className="text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-state-error)]">
                {failure}
              </p>
            )}
          </>
        )}
      </div>

    </StepFrame>
  );
}

function ReviewRow({
  label,
  value,
  change,
}: {
  label: string;
  value: string;
  change?: { label: string; run: () => void } | undefined;
}) {
  return (
    <li className="flex items-center justify-between gap-md px-md py-sm">
      <span className="min-w-0">
        <span className="block text-[length:var(--nf-text-caption)] text-[var(--nf-content-muted)]">{label}</span>
        <span className="block truncate text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-primary)]">{value}</span>
      </span>
      {change ? (
        <button type="button" className="nf-g1-change" onClick={change.run}>
          {change.label}
          <UiIcon name="chevron-right" size={16} />
        </button>
      ) : null}
    </li>
  );
}

/**
 * Submitted.
 *
 * It says what happens next and roughly when, and both halves matter. "Thanks,
 * we will be in touch" is the version that generates the support ticket: it
 * leaves somebody who has just handed over a photograph of their passport with
 * no idea whether to wait an hour or a fortnight, and no idea what arriving
 * looks like. "A person reads it, most take one working day, we email you
 * either way, and if anything is wrong we say exactly what" is four facts they
 * can plan around.
 */
/** Each step's object: the ID, the home, the business, the consent. */
const STEP_ART: Record<StepId, Icon3DName> = {
  "identity-document": "id-check",
  selfie: "camera",
  "address-document": "home-small",
  "business-question": "city",
  "business-details": "folder",
  consent: "shield",
  review: "verified",
};

function Submitted({ copy, payoutHref }: { copy: KycCopy; payoutHref?: string }) {
  return (
    <div className="mx-auto max-w-md py-xl text-center">
      <span className="mx-auto grid size-[5.5rem] place-items-center" aria-hidden="true" data-art="calendar-pending">
        <Icon3D name="calendar-pending" size={88} />
      </span>
      <h1 className="nf-h2 mt-md">{copy.sentTitle}</h1>
      <p className="mt-sm text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
        {copy.sentBody}
      </p>
      <p className="mt-sm text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-muted)]">
        {copy.sentMeanwhile}
      </p>
      {/* What happens next, in order: the review, then the bank account whose
          name is checked against the ID (listers only). */}
      <ol className="nf-panel nf-panel--card mt-lg block space-y-sm p-md text-left" data-testid="kyc-next-steps" aria-label={copy.nextTitle}>
        <li className="flex items-start gap-sm">
          <span className="nf-numeric grid size-6 shrink-0 place-items-center rounded-full bg-[var(--nf-surface-secondary)] text-[length:var(--nf-text-caption)] font-semibold text-[var(--nf-content-primary)]">1</span>
          <span className="text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">{copy.nextReview}</span>
        </li>
        {payoutHref ? (
          <li className="flex items-start gap-sm">
            <span className="nf-numeric grid size-6 shrink-0 place-items-center rounded-full bg-[var(--nf-surface-secondary)] text-[length:var(--nf-text-caption)] font-semibold text-[var(--nf-content-primary)]">2</span>
            <span className="text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
              {copy.nextPayout}{" "}
              <Link href={payoutHref} className="font-semibold text-[var(--nf-content-link)] underline-offset-4 hover:underline" data-testid="kyc-next-payout">
                {copy.nextPayoutAction}
              </Link>
            </span>
          </li>
        ) : null}
      </ol>
      <Link
        href="/profile"
        className="mt-lg inline-flex items-center gap-2xs text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-link)] underline-offset-4 hover:underline"
      >
        {copy.sentAction}
        <UiIcon name="arrow-right" size="sm" />
      </Link>
    </div>
  );
}

/* --------------------------------------------------------------- the copy */
/* The words are the dictionary's (`experienceAccount.kyc`). A business field
   and a gap are looked up by their key; a consent keeps its recorded English
   label (kyc.ts). */
/* A field with nothing to add under its label has no `hint` at all, rather than an empty one. */
function fieldWords(name: string, copy: KycCopy): { label: string; hint?: string } {
  return (copy.fields as Record<string, { label: string; hint?: string }>)[name] ?? { label: name };
}

function gapWords(item: MissingItem, copy: KycCopy): string {
  switch (item.kind) {
    case "document":
      return copy.documents[item.document].title;
    case "selfie":
      return copy.gapSelfie;
    case "which-id":
      return copy.gapWhichId;
    case "which-address":
      return copy.gapWhichAddress;
    case "address-date":
      return copy.gapAddressDate;
    case "field":
      return fieldWords(item.name, copy).label;
    case "consent":
      return CONSENTS.find((c) => c.id === item.id)?.label ?? item.id;
  }
}

/** "Documents sent", once, over the in-review screen. */
function KycSentSheet({ copy }: { copy: SuccessWords }) {
  const [open, setOpen] = useState(true);
  const words = successCopy(copy, "kycSubmitted");
  return (
    <SuccessSheet
      open={open}
      onOpenChange={setOpen}
      variant={words.variant}
      object={words.object}
      title={words.title}
      body={words.body}
      primary={{ label: copy.continue }}
    />
  );
}
