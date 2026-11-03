"use client";

import { PhoneField } from "@/components/app/PhoneField";
import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useBack } from "@/lib/nav/use-back";
import type { OwnerCopy } from "./supply-copy";
import { TYPE } from "@/components/app/Screen";
import { TextField } from "@/components/ui/Field";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { ChoicePicker, type ChoiceGroup } from "@/components/app/place/ChoicePicker";
import { fetchLocalGovernments } from "@/lib/places/actions";
import type { StateOption } from "@/lib/places/reference";
import {
  OWNERSHIP_ANSWERS,
  REGISTER_STEPS,
  earliestStep,
  type OwnershipAnswer,
} from "@/lib/supply/registration-model";
import { submitSupplyRegistration } from "@/lib/supply/registration-actions";
import { RegField, RegFieldGroup } from "./RegisterField";
import { CalmPanel, RegisterDone, RegisterShell } from "./RegisterShell";
import { RegistrationFiledSheet } from "./RegistrationFiledSheet";
import { WorkspaceAcceptance } from "@/components/legal/WorkspaceAcceptance";
import { UploadCard, newBatchId, type UploadState } from "./UploadCard";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * GOVERNING-03, THE OWNER FORM, AND IT IS THE ONE THAT MATTERS.
 *
 * Four screens: about you, where do you own, proof of ownership with "I have
 * none of these", and the confirmation. This is the door a landlord who is not
 * an agent and never will be walks through, and until it existed the only way
 * into the supply side of this platform was marked for professionals.
 *
 * ---------------------------------------------------------------------------
 * SCREEN THREE IS THE WHOLE POINT OF THE BUILD
 *
 * Most Nigerian land sits outside the formal register and most landlords hold
 * no title document at all. A form that requires a Certificate of Occupancy
 * therefore turns away the large majority of the people this platform is
 * trying to reach.
 *
 * SO "I HAVE NONE OF THESE" IS A FIRST CLASS ANSWER. Look at what this
 * component does with it and what it does NOT do:
 *
 *   - It is in `OWNERSHIP_ANSWERS` with the other five and it is drawn with
 *     the same row, the same plate, the same ring and the same weight.
 *   - Choosing it does not disable the Continue control, does not add a screen,
 *     does not open a sheet asking whether they are sure, and does not mark the
 *     row in any colour. There is no second chance and no nag, because a nag is
 *     how a form tells somebody they gave the wrong answer.
 *   - It files the same SUBMITTED application as any other answer, through the
 *     same action, with the same reference.
 *   - The ONE thing it changes is the sentence on screen four: the listing will
 *     not carry the ownership mark. That is the only difference there is, and
 *     the person is told it plainly rather than discovering it later.
 *
 * The reassurance beside it is the one `lib/supply/roles.ts` already wrote, so
 * the door's promise and the form's promise cannot drift apart. NEITHER
 * TITLING FIGURE IS PRINTED: both rest on a search summary rather than a
 * primary source and a lawyer confirms them before any number becomes copy.
 *
 * ---------------------------------------------------------------------------
 * WHAT SCREEN TWO DOES NOT DRAW, SAID PLAINLY RATHER THAN QUIETLY OMITTED
 *
 * `GOVERNING-03` screen two draws a map with a draggable pin. This screen ships
 * without one and that is deliberate on two grounds. `NEXT_PUBLIC_MAPTILER_KEY`
 * is unset on this platform, so a map here would be a rectangle of nothing
 * where the render draws a city. And the exact building is a fact about a
 * PROPERTY, which the listing wizard already owns and already asks for; a pin
 * dropped during registration, before any property exists, would be a pin
 * attached to nobody. The state, the local government and the neighbourhood
 * are what a registration can honestly hold, and the screen says where the pin
 * belongs instead of pretending it is not missing.
 */

const DOC_ICON = "document" as const;

export function OwnerRegisterForm({
  t,
  states,
  startAt = 0,
}: {
  t: OwnerCopy;
  states: StateOption[];
  /**
   * WHICH SCREEN TO OPEN ON, AND THE ONLY CALLER IS THE PREVIEW HARNESS.
   *
   * `/profile/setup/owner` never passes it and always opens on the first
   * screen. Every Supabase origin is refused by this sandbox's egress proxy,
   * so the two pickers on screen two have no rows to offer and the Continue
   * control below them is correctly disabled; without this there would be no
   * way to photograph screen three on the only kind of server a proof counts
   * from. It defaults to the beginning, so forgetting it cannot change what a
   * person sees.
   */
  startAt?: number;
}) {
  const leave = useBack("/profile/setup");
  const copy = t.supply.register;
  const own = copy.owner;
  const steps = REGISTER_STEPS.owner.length;

  const [step, setStep] = useState(startAt);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [nin, setNin] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [lgaCode, setLgaCode] = useState("");
  const [area, setArea] = useState("");
  const [held, setHeld] = useState<OwnershipAnswer | null>(null);
  /* The document itself, uploaded into the private bucket the moment it is
     chosen. Optional: the answer can be filed now and the paper sent later. */
  const [batchId] = useState(newBatchId);
  const [proof, setProof] = useState<UploadState | null>(null);

  const [lgas, setLgas] = useState<ChoiceGroup[]>([]);
  const [lgaLoading, setLgaLoading] = useState(false);
  const loadedState = useRef("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [screenError, setScreenError] = useState<string | null>(null);
  const [filed, setFiled] = useState<{
    reference: string;
    mark: boolean;
    attached: boolean;
  } | null>(null);
  const [pending, startTransition] = useSafeTransition();
  /* Ruling 6 (13 October 2026): the two ticks before this is sent. */
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPay, setAcceptPay] = useState(false);

  const loadLgas = useCallback(async (code: string) => {
    if (code === "" || loadedState.current === code) return;
    loadedState.current = code;
    setLgaLoading(true);
    try {
      const result = await fetchLocalGovernments(code);
      setLgas(
        result.ok && result.data.length > 0
          ? [
              {
                category: "",
                options: result.data.map((r) => ({
                  code: r.code,
                  name: r.name,
                })),
              },
            ]
          : []
      );
    } catch {
      /* The picker's own empty state explains that the list would not load. */
      setLgas([]);
      loadedState.current = "";
    } finally {
      setLgaLoading(false);
    }
  }, []);

  const stateGroups: ChoiceGroup[] = useMemo(
    () => [
      {
        category: "",
        options: states.map((s) => ({ code: s.code, name: s.name })),
      },
    ],
    [states]
  );

  const stateName = states.find((s) => s.code === stateCode)?.name ?? "";

  function back() {
    setScreenError(null);
    if (step === 0) {
      /* Leaving the form is a real back: the chooser when that is where the
         person came from (history, so no second chooser entry), otherwise
         the declared parent. It used to push the chooser, which stacked a
         chooser on top of the chooser the person had come from. */
      leave();
      return;
    }
    setStep((s) => s - 1);
  }

  /*
   * THE ONLY GATE ON EACH SCREEN IS THE SCREEN'S OWN QUESTION.
   *
   * The server validates everything again and is the authority; this exists so
   * that pressing Continue with an empty name does not make somebody walk
   * three more screens before being told. The NIN is required, so the first
   * screen holds Continue until it is eleven digits.
   */
  function blocked(): boolean {
    if (step === 0) return fullName.trim().length < 2 || phone.trim() === "" || !/^\d{11}$/.test(nin.trim());
    if (step === 1) return stateCode === "" || lgaCode === "";
    if (step === 2) return held === null || !acceptTerms || !acceptPay;
    return false;
  }

  function forward() {
    setScreenError(null);
    if (step < 2) {
      setStep(step + 1);
      return;
    }
    if (held === null) return;
    startTransition(async () => {
      try {
        const result = await submitSupplyRegistration({
          role: "owner",
          fullName: fullName.trim(),
          phone: phone.trim(),
          nin: nin.trim(),
          stateCode,
          lgaCode,
          area: area.trim(),
          ownershipDocument: held,
          /* A document goes only with an answer that names one. */
          ownershipPath: held !== "none" ? (proof?.path ?? "") : "",
          acceptTerms,
          acceptPayOnVallo: acceptPay,
        });
        if (!result.ok) {
          setErrors(result.fieldErrors ?? {});
          setScreenError(result.error);
          const walkBack = earliestStep(result.fieldErrors, "owner");
          if (walkBack !== null) setStep(walkBack);
          return;
        }
        setErrors({});
        setFiled({
          reference: result.data.reference,
          mark: result.data.canEarnOwnershipMark,
          attached: result.data.documentsAttached,
        });
        setStep(3);
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

  if (step === 3 && filed) {
    return (
      <>
        <OwnerDoneScreen t={t} filed={filed} />
        <RegistrationFiledSheet reference={filed.reference} copy={t.success} />
      </>
    );
  }

  const screen = [
    {
      heading: own.you.title,
      sub: own.you.sub,
      /* The owner door's own object (AddWorkspaceChooser), so the form
         continues the door that was chosen. */
      mark: "modern-house" as const,
      body: (
        <div className="grid gap-row">
          <RegFieldGroup>
            <RegField>
              <TextField
                label={own.you.name}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                required
                {...(errors.fullName ? { error: errors.fullName } : {})}
              />
            </RegField>
            <RegField>
              {/* Details pass: the one phone field, +234 fixed beside the box,
                  grouped as it is read aloud, the network named. */}
              <PhoneField
                name="phone"
                label={own.you.phone}
                value={phone}
                onChange={setPhone}
                required
                error={errors.phone}
              />
            </RegField>
            <RegField>
              <TextField
                label={own.you.nin}
                hint={own.you.ninHint}
                value={nin}
                onChange={(e) => setNin(e.target.value.replace(/\D/g, "").slice(0, 11))}
                inputMode="numeric"
                /* Never autofilled, never remembered by the browser, and never
                   logged anywhere by this platform. */
                autoComplete="off"
                required
                {...(errors.nin ? { error: errors.nin } : {})}
              />
            </RegField>
          </RegFieldGroup>
          <CalmPanel icon="shield-stop" body={own.you.assurance} />
        </div>
      ),
    },
    {
      heading: own.where.title,
      sub: own.where.sub,
      mark: undefined,
      body: (
        <div className="grid gap-row">
          <RegFieldGroup>
            <RegField>
              <ChoicePicker
                t={t}
                name="stateCode"
                label={t.pickers.stateLabel}
                placeholder={t.pickers.statePlaceholder}
                searchPlaceholder={t.pickers.stateSearch}
                value={stateCode}
                groups={stateGroups}
                onChange={(code) => {
                  setLgas([]);
                  loadedState.current = "";
                  setStateCode(code);
                  setLgaCode("");
                  if (code) void loadLgas(code);
                }}
                {...(errors.stateCode ? { error: errors.stateCode } : {})}
              />
            </RegField>
            <RegField>
              <ChoicePicker
                t={t}
                name="lgaCode"
                label={t.pickers.lgaLabel}
                placeholder={stateCode ? t.pickers.lgaPlaceholder : t.pickers.lgaLocked}
                searchPlaceholder={
                  stateName ? t.pickers.searchIn.replace("{place}", stateName) : t.pickers.search
                }
                value={lgaCode}
                groups={lgas}
                loading={lgaLoading}
                disabled={stateCode === ""}
                disabledHint={t.pickers.lgaDisabledHint}
                onChange={setLgaCode}
                onOpen={() => void loadLgas(stateCode)}
                {...(errors.lgaCode ? { error: errors.lgaCode } : {})}
              />
            </RegField>
            <RegField optional={copy.optional}>
              <TextField
                label={own.where.area}
                hint={own.where.areaHint}
                value={area}
                onChange={(e) => setArea(e.target.value)}
                {...(errors.area ? { error: errors.area } : {})}
              />
            </RegField>
          </RegFieldGroup>
        </div>
      ),
    },
    {
      heading: own.proof.title,
      sub: own.proof.sub,
      mark: "doc-home" as const,
      body: (
        <>
          <ul className="grid gap-inline" role="radiogroup" aria-label={own.proof.title}>
            {OWNERSHIP_ANSWERS.map((answer) => {
              const chosen = held === answer;
              return (
                <li
                  key={answer}
                  role="presentation"
                  className={answer === "none" ? "mt-group" : undefined}
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={chosen}
                    onClick={() => setHeld(answer)}
                    className="nf-door nf-door--compact"
                    data-on={chosen || undefined}
                  >
                    <span className="nf-door__mark" aria-hidden="true">
                      <UiIcon name={DOC_ICON} size="md" />
                    </span>
                    <span className={`min-w-0 flex-1 text-left ${TYPE.rowTitle}`}>
                      {own.proof.docs[answer]}
                    </span>
                    <span className="nf-choicemark" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
          {/*
            SHOWN ONLY ON THE HONEST ANSWER, AND IT IS REASSURANCE RATHER THAN
            A WARNING. Nothing about it is tinted, nothing is disabled, and the
            Continue control below is exactly as lit as it is for a Certificate
            of Occupancy.
          */}
          {held === "none" ? (
            <CalmPanel title={own.proof.stillListTitle} body={own.proof.stillListBody} />
          ) : null}
          {/* THE PAPER ITSELF, for any answer that names one. Optional, as the
              NIN is: the answer files without it. A reviewer opens it through
              the audited document route, and approving it is what earns the
              "Ownership seen" mark. */}
          {held !== null && held !== "none" ? (
            <div className="mt-group">
              <UploadCard
                t={t}
                object="doc-home"
                title={own.proof.uploadTitle}
                body={own.proof.uploadBody}
                slot="ownership"
                batchId={batchId}
                value={proof}
                onChange={setProof}
                {...(errors.ownershipPath ? { error: errors.ownershipPath } : {})}
              />
            </div>
          ) : null}
        </>
      ),
    },
  ][step] ?? { heading: "", sub: undefined, mark: undefined, body: null };

  return (
    <RegisterShell
      formTitle={own.title}
      heading={screen.heading}
      {...(screen.sub ? { sub: screen.sub } : {})}
      steps={steps}
      current={step}
      stepOfLabel={copy.stepOf
        .replace("{step}", String(step + 1))
        .replace("{total}", String(steps))}
      backLabel={copy.back}
      onBack={back}
      {...(screen.mark ? { mark: screen.mark } : {})}
      error={screenError}
      primary={{
        label: step === 2 ? (pending ? copy.submitting : copy.submit) : copy.continue,
        onClick: forward,
        disabled: blocked() || pending,
        icon: "arrow-right",
      }}
    >
      {screen.body}
      {step === 2 ? (
        <WorkspaceAcceptance
          className="mt-md"
          copy={t.payChoice}
          terms={acceptTerms}
          pay={acceptPay}
          onTerms={setAcceptTerms}
          onPay={setAcceptPay}
          showError={Boolean(errors.acceptTerms || errors.acceptPayOnVallo)}
        />
      ) : null}
    </RegisterShell>
  );
}

/**
 * SCREEN FOUR, AND THE ONE LINE OF THE RENDER THAT DOES NOT SHIP.
 *
 * `GOVERNING-03` screen four reads "You are set up as an owner" over a
 * checklist whose first row is "Your details are verified". Neither is true at
 * the moment this screen appears: insert on `public.agents` is admin only by
 * policy, so a filed application is a filed application and nobody has looked
 * at it yet. The reference set's own rule is that a count or a statistic in a
 * render is example content; a STATUS in a render is example content by the
 * same argument and with more at stake, because the platform's verified mark
 * is the one thing it cannot spend.
 *
 * So the composition is the render's, exactly: the glass object on its pool of
 * light, the heading, one line, the panel of three, the timing label and the
 * two controls. The claim is ours and it is true.
 *
 * Exported so the preview harness can draw the real screen rather than a
 * facsimile of it. The route needs a session and the proof server has none.
 */
export function OwnerDoneScreen({
  t,
  filed,
}: {
  t: OwnerCopy;
  filed: { reference: string; mark: boolean; attached: boolean };
}) {
  const router = useRouter();
  const copy = t.supply.register;
  const own = copy.owner;
  const steps = REGISTER_STEPS.owner.length;

  return (
    <RegisterShell
      formTitle={own.title}
      heading=""
      steps={steps}
      current={steps - 1}
      stepOfLabel={copy.stepOf.replace("{step}", String(steps)).replace("{total}", String(steps))}
      backLabel={copy.back}
      onBack={() => router.replace("/home")}
      primary={{
        label: copy.trackIt,
        onClick: () => router.replace("/profile/application"),
      }}
      secondary={{ label: copy.backHome, onClick: () => router.replace("/home") }}
    >
      <RegisterDone
        object="home-check"
        heading={own.done.title}
        sub={own.done.sub}
        filedLine={copy.filedAs.replace("{reference}", filed.reference)}
        whatNext={copy.whatNext}
        lines={[own.done.nextOne, own.done.nextTwo, own.done.nextThree]}
        timing={copy.reviewDays}
        note={filed.mark ? own.done.markPending : own.done.markNone}
      >
        {filed.attached ? null : <CalmPanel body={copy.documentsMissed} />}
      </RegisterDone>
    </RegisterShell>
  );
}
