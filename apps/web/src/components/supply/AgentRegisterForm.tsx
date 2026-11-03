"use client";

import { PhoneField } from "@/components/app/PhoneField";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useBack } from "@/lib/nav/use-back";
import { formatMoney, intlTag, type Locale } from "@vallo/i18n/core";
import type { RegisterCopy } from "./supply-copy";
import { TYPE } from "@/components/app/Screen";
import { SelectField, TextField } from "@/components/ui/Field";
import { UiIcon } from "@/design-system/icons/UiIcon";
import {
  EXPERIENCE_BANDS,
  EXAMPLE_RENT_MINOR,
  REGISTER_STEPS,
  bpsAsFraction,
  earliestStep,
  stepFee,
  tenantTotal,
  type ExperienceBand,
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
 * GOVERNING-04, THE AGENT FORM.
 *
 * Four screens: about you, prove who you are, your fees in the open with the
 * live tenant total, and submitted.
 *
 * ---------------------------------------------------------------------------
 * SCREEN THREE IS THE ARGUMENT MADE VISIBLE
 *
 * Vallo does not remove the agent. Vallo removes the runaround. The runaround
 * is not that an agent charges a fee; it is that nobody can find out what the
 * fee is until they have paid to inspect four flats. So this platform does not
 * cap anybody's fee and does not intend to. It PUBLISHES it, and it shows the
 * agent what a tenant will read while they are still deciding what to charge.
 *
 * Three rules hold that screen honest:
 *
 *   1. THE CONTROL STARTS UNDECLARED. Zero is a strong claim, "I charge no
 *      agency fee" is a selling point, and nobody is credited with it by
 *      failing to answer. A person reaches zero by stepping down to it on
 *      purpose, and can step back out again.
 *   2. AN UNDECLARED COST IS DRAWN AS NOT DECLARED, NEVER AS ZERO. The total
 *      adds only what has been declared and the panel names what is missing.
 *   3. THE TOTAL IS HONEST ABOUT ITS OWN SCOPE. The caution deposit, the
 *      service charge and the agreement fee belong to a property and are set
 *      on a listing, so they are not in this figure and the panel says so. A
 *      total that quietly left them out while calling itself "what a tenant
 *      pays" would be the same lie this screen exists to end.
 *
 * THE EXAMPLE RENT IS THE AGENT'S OWN AND IT IS EDITABLE. `GOVERNING-04` draws
 * the worked example on a fixed rent. A fixed figure there would be the
 * platform stating what Lagos costs, which is an invented number with a
 * caption; the field starts somewhere sensible, the agent changes it to a rent
 * they actually work with, and nothing about it is saved.
 *
 * NO PERCENTAGE IS EVER A STRING. The fee reads through `Intl.NumberFormat` in
 * the reader's own locale, so the per cent sign is the formatter's and not a
 * word in a dictionary that a spec would have to allow through.
 */

export function AgentRegisterForm({
  t,
  locale,
  startAt = 0,
}: {
  t: RegisterCopy;
  /** For the money and the percentage, both of which are formatted, not built. */
  locale: Locale;
  /** The preview harness only. See the note on the owner form. */
  startAt?: number;
}) {
  const leave = useBack("/profile/setup");
  const copy = t.supply.register;
  const mine = copy.agent;
  const steps = REGISTER_STEPS.agent.length;
  /* A stable folder per form session, so a retry does not scatter objects.
     `useState` with an initialiser rather than a ref: the value is read during
     render and a ref read during render is exactly what `react-hooks/refs`
     reports, correctly. */
  const [batchId] = useState(newBatchId);

  const [step, setStep] = useState(startAt);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [experience, setExperience] = useState<ExperienceBand | "">("");
  const [nin, setNin] = useState("");
  const [idDoc, setIdDoc] = useState<UploadState | null>(null);
  const [selfie, setSelfie] = useState<UploadState | null>(null);
  const [agencyFeeBps, setAgencyFeeBps] = useState<number | null>(null);
  const [legalFeeBps, setLegalFeeBps] = useState<number | null>(null);
  const [exampleRent, setExampleRent] = useState(String(EXAMPLE_RENT_MINOR / 100));

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [screenError, setScreenError] = useState<string | null>(null);
  const [filed, setFiled] = useState<{
    reference: string;
    attached: boolean;
  } | null>(null);
  const [pending, startTransition] = useSafeTransition();
  /* Ruling 6 (13 October 2026): the two ticks before this is sent. */
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPay, setAcceptPay] = useState(false);

  /* Naira in, kobo out, rounded once, at the boundary and nowhere else. */
  const rentMinor = useMemo(() => {
    const naira = Number(exampleRent.replace(/[^\d]/g, ""));
    return Number.isFinite(naira) ? Math.round(naira * 100) : 0;
  }, [exampleRent]);

  const total = useMemo(
    () => tenantTotal({ rentMinor, agencyFeeBps, legalFeeBps }),
    [rentMinor, agencyFeeBps, legalFeeBps]
  );

  const percent = useMemo(
    () =>
      new Intl.NumberFormat(intlTag[locale], {
        style: "percent",
        maximumFractionDigits: 2,
      }),
    [locale]
  );

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

  function blocked(): boolean {
    if (step === 0) return fullName.trim().length < 2 || phone.trim() === "" || experience === "" || !/^\d{11}$/.test(nin.trim());
    /*
     * SCREEN TWO IS NOT GATED ON THE UPLOADS, and that is deliberate rather
     * than an oversight. An agent standing in a compound with no ID to hand
     * must be able to finish and come back; the verification ladder is where a
     * missing document costs something, and it says so there in full. What the
     * screen does NOT do is pretend a slot is filled when it is not.
     */
    /* The last screen waits for the two ticks (ruling 6). */
    if (step === 2) return !acceptTerms || !acceptPay;
    return false;
  }

  function forward() {
    setScreenError(null);
    if (step < 2) {
      setStep(step + 1);
      return;
    }
    if (experience === "") return;
    startTransition(async () => {
      try {
        const result = await submitSupplyRegistration({
          role: "agent",
          fullName: fullName.trim(),
          phone: phone.trim(),
          nin: nin.trim(),
          experience,
          agencyFeeBps,
          legalFeeBps,
          idPath: idDoc?.path ?? "",
          selfiePath: selfie?.path ?? "",
          acceptTerms,
          acceptPayOnVallo: acceptPay,
        });
        if (!result.ok) {
          setErrors(result.fieldErrors ?? {});
          setScreenError(result.error);
          const walkBack = earliestStep(result.fieldErrors);
          if (walkBack !== null) setStep(walkBack);
          return;
        }
        setErrors({});
        setFiled({
          reference: result.data.reference,
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
        <AgentDoneScreen t={t} filed={filed} />
        <RegistrationFiledSheet reference={filed.reference} copy={t.success} />
      </>
    );
  }

  const screen = [
    {
      heading: mine.you.title,
      sub: mine.you.sub,
      body: (
        <div className="grid gap-row">
          {/* ONE PANEL AROUND THE THREE QUESTIONS, which is how `GOVERNING-04`
              screen one draws them: a single glass card, each question keeping
              its own name over its own well. */}
          <RegFieldGroup>
            <RegField>
              <TextField
                label={mine.you.name}
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
                label={mine.you.phone}
                value={phone}
                onChange={setPhone}
                required
                error={errors.phone}
              />
            </RegField>
            <RegField>
              <SelectField
                label={mine.you.experience}
                value={experience}
                onChange={(e) => setExperience(e.target.value as ExperienceBand)}
                required
                {...(errors.experience ? { error: errors.experience } : {})}
              >
                <option value="" disabled />
                {EXPERIENCE_BANDS.map((band) => (
                  <option key={band} value={band}>
                    {mine.you.bands[band]}
                  </option>
                ))}
              </SelectField>
            </RegField>
          </RegFieldGroup>
          <CalmPanel body={mine.you.assurance} />
        </div>
      ),
    },
    {
      heading: mine.identity.title,
      sub: mine.identity.sub,
      body: (
        <div className="grid gap-group">
          <UploadCard
            t={t}
            /* `id-card-check`, AND THE FIRST PASS OF THIS BUILD GOT IT WRONG
               IN THE OTHER DIRECTION, so the reasoning is written down rather
               than quietly reversed.

               The glass library has TWO axes and they are not the same axis.
               23 objects ship a light twin and the rest do not, which shows up
               on paper only. Separately, some objects are solid three
               dimensional glass and a few are flat outlines, which shows up in
               BOTH themes and at every size. `id-card-check` is solid and
               twinned; `user-check` beneath it is solid and untwinned;
               `person-card` is untwinned and FLAT.

               Swapping to `person-card` made the pair agree about paper and
               disagree about artwork, which is the louder fault and visible to
               everybody. So the pair is solid-and-solid, and the paper gap is
               reported as what it is: `user-check` needs a light twin
               commissioning, which is artwork and not a code change. */
            object="id-card-check"
            title={mine.identity.idTitle}
            body={mine.identity.idBody}
            slot="identity"
            batchId={batchId}
            value={idDoc}
            onChange={setIdDoc}
            {...(errors.idPath ? { error: errors.idPath } : {})}
          />
          <UploadCard
            t={t}
            object="user-check"
            title={mine.identity.selfieTitle}
            body={mine.identity.selfieBody}
            slot="selfie"
            batchId={batchId}
            value={selfie}
            onChange={setSelfie}
            accept="image/png,image/jpeg"
            {...(errors.selfiePath ? { error: errors.selfiePath } : {})}
          />
          <RegFieldGroup>
            <RegField>
              <TextField
                label={mine.identity.nin}
                placeholder={mine.identity.ninPlaceholder}
                hint={mine.identity.ninHint}
                value={nin}
                onChange={(e) => setNin(e.target.value.replace(/\D/g, "").slice(0, 11))}
                inputMode="numeric"
                autoComplete="off"
                required
                {...(errors.nin ? { error: errors.nin } : {})}
              />
            </RegField>
          </RegFieldGroup>
        </div>
      ),
    },
    {
      heading: mine.fees.title,
      sub: mine.fees.sub,
      body: (
        <div className="grid gap-row">
          {/* Both fees in one panel, as `GOVERNING-04` screen three draws
              them, with the lit total below on its own. */}
          <RegFieldGroup>
            <RegField>
              <FeeStepper
                label={mine.fees.agency}
                meaning={mine.fees.agencyMeaning}
                value={agencyFeeBps}
                onChange={setAgencyFeeBps}
                lessLabel={mine.fees.less}
                moreLabel={mine.fees.more}
                undeclaredLabel={copy.notDeclared}
                percent={percent}
                {...(errors.agencyFeeBps ? { error: errors.agencyFeeBps } : {})}
              />
            </RegField>
            <RegField>
              <FeeStepper
                label={mine.fees.legal}
                meaning={mine.fees.legalMeaning}
                value={legalFeeBps}
                onChange={setLegalFeeBps}
                lessLabel={mine.fees.less}
                moreLabel={mine.fees.more}
                undeclaredLabel={copy.notDeclared}
                percent={percent}
                {...(errors.legalFeeBps ? { error: errors.legalFeeBps } : {})}
              />
            </RegField>
          </RegFieldGroup>

          <RegFieldGroup>
            <RegField>
              <TextField
                label={mine.fees.exampleLabel}
                hint={mine.fees.exampleHint}
                value={exampleRent}
                onChange={(e) => setExampleRent(e.target.value.replace(/[^\d]/g, ""))}
                inputMode="numeric"
              />
            </RegField>
          </RegFieldGroup>

          {/* THE LIVE TENANT TOTAL. Everything in it moves the moment either
              control moves, which is the whole point: the agent is looking at
              what a tenant will read while they decide. */}
          <div className="nf-panel nf-panel--card block p-card" aria-live="polite">
            <p className={TYPE.label}>{mine.fees.totalLead}</p>
            <p className="nf-totalpanel__figure mt-inline-tight">
              {formatMoney(total.totalMinor, locale)}
            </p>
            <p className={`mt-inline-tight ${TYPE.rowMeta}`}>{mine.fees.totalTrail}</p>

            <ul className="mt-group grid gap-inline-tight">
              <TotalLine label={mine.fees.partRent} value={formatMoney(total.rentMinor, locale)} />
              <TotalLine
                label={mine.fees.partAgency}
                value={
                  total.agencyMinor === null
                    ? copy.notDeclared
                    : formatMoney(total.agencyMinor, locale)
                }
                undeclared={total.agencyMinor === null}
              />
              <TotalLine
                label={mine.fees.partLegal}
                value={
                  total.legalMinor === null
                    ? copy.notDeclared
                    : formatMoney(total.legalMinor, locale)
                }
                undeclared={total.legalMinor === null}
              />
            </ul>

            <p className={`mt-group ${TYPE.rowMeta}`}>{mine.fees.perListing}</p>
          </div>

          <CalmPanel body={mine.fees.weTakeNone} />
        </div>
      ),
    },
  ][step] ?? { heading: "", sub: undefined, body: null };

  return (
    <RegisterShell
      formTitle={mine.title}
      heading={screen.heading}
      {...(screen.sub ? { sub: screen.sub } : {})}
      steps={steps}
      current={step}
      stepOfLabel={copy.stepOf
        .replace("{step}", String(step + 1))
        .replace("{total}", String(steps))}
      backLabel={copy.back}
      onBack={back}
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

/* ------------------------------------------------------------------ parts */

function TotalLine({
  label,
  value,
  undeclared = false,
}: {
  label: string;
  value: string;
  undeclared?: boolean;
}) {
  return (
    <li className="flex items-baseline justify-between gap-inline">
      <span className={TYPE.rowMeta}>{label}</span>
      <span
        className={
          undeclared
            ? `nf-totalpanel__undeclared ${TYPE.rowMeta}`
            : "font-[family-name:var(--nf-font-numeric)] text-[length:var(--nf-text-body)] font-semibold text-[var(--nf-content-primary)]"
        }
      >
        {value}
      </span>
    </li>
  );
}

/**
 * MINUS, THE FIGURE, PLUS.
 *
 * The figure is a reading rather than a text field on purpose: a fee typed
 * freehand is a fee somebody enters as "10" meaning ten per cent and as "0.1"
 * meaning the same thing, and the step is what makes the unit unambiguous.
 * `aria-live` on the value so a screen reader hears each press.
 */
function FeeStepper({
  label,
  meaning,
  value,
  onChange,
  lessLabel,
  moreLabel,
  undeclaredLabel,
  percent,
  error,
}: {
  label: string;
  meaning: string;
  value: number | null;
  onChange(next: number | null): void;
  lessLabel: string;
  moreLabel: string;
  undeclaredLabel: string;
  percent: Intl.NumberFormat;
  error?: string | undefined;
}) {
  return (
    <div>
      <span className="nf-label">{label}</span>
      <p className={`mt-inline-tight ${TYPE.rowMeta}`}>{meaning}</p>
      <div className="nf-feestep mt-xs">
        <button
          type="button"
          className="nf-feestep__step"
          aria-label={lessLabel}
          onClick={() => onChange(stepFee(value, -1))}
          disabled={value === null}
        >
          <UiIcon name="minus" size={20} />
        </button>
        <span
          className="nf-feestep__value"
          aria-live="polite"
          {...(value === null ? { "data-undeclared": true } : {})}
        >
          {value === null ? undeclaredLabel : percent.format(bpsAsFraction(value))}
        </span>
        <button
          type="button"
          className="nf-feestep__step"
          aria-label={moreLabel}
          onClick={() => onChange(stepFee(value, 1))}
        >
          <UiIcon name="plus" size={20} />
        </button>
      </div>
      {error ? (
        <p
          role="alert"
          className="nf-arrive mt-xs text-[length:var(--nf-text-caption)] font-semibold text-[var(--nf-state-error)]"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * SCREEN FOUR, and it says what the render says, because here the render is
 * already true: an agent's application IS being checked and nothing on this
 * screen claims a check has finished.
 *
 * Exported so the preview harness can draw the real screen. The route needs a
 * session and the proof server has none.
 */
export function AgentDoneScreen({
  t,
  filed,
}: {
  t: RegisterCopy;
  filed: { reference: string; attached: boolean };
}) {
  const router = useRouter();
  const copy = t.supply.register;
  const mine = copy.agent;
  const steps = REGISTER_STEPS.agent.length;

  return (
    <RegisterShell
      formTitle={mine.title}
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
        object="keys-tag"
        heading={mine.done.title}
        sub={mine.done.sub}
        filedLine={copy.filedAs.replace("{reference}", filed.reference)}
        whatNext={copy.whatNext}
        lines={[mine.done.nextOne, mine.done.nextTwo, mine.done.nextThree]}
        timing={copy.reviewDays}
      >
        {filed.attached ? null : <CalmPanel body={copy.documentsMissed} />}
      </RegisterDone>
    </RegisterShell>
  );
}
