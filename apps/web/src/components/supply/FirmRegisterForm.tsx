"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useBack } from "@/lib/nav/use-back";
import type { RegisterCopy } from "./supply-copy";
import { TYPE } from "@/components/app/Screen";
import { TextField } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { BrandIcon } from "@/design-system/icons/BrandIcon";
import { UiIcon } from "@/design-system/icons/UiIcon";
import {
  ASSOCIATION_PROOFS,
  MAX_DECLARED_TEAM,
  REGISTER_STEPS,
  earliestStep,
  type AssociationProof,
} from "@/lib/supply/registration-model";
import { submitSupplyRegistration } from "@/lib/supply/registration-actions";
import { RegField, RegFieldGroup } from "./RegisterField";
import { CalmPanel, RegisterDone, RegisterShell } from "./RegisterShell";
import { RegistrationFiledSheet } from "./RegistrationFiledSheet";
import { WorkspaceAcceptance } from "@/components/legal/WorkspaceAcceptance";
import { UploadCard, newBatchId, type UploadState } from "./UploadCard";
import { IconPlate } from "@/components/ui/IconPlate";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

/**
 * GOVERNING-05, THE FIRM FORM, WHICH IS A BRANCH AND NOT A THIRD ROLE.
 *
 * Four screens: your firm with the RC and the LASRERA number, prove you work
 * here, your team, and under review.
 *
 * A firm's proof set is a SUPERSET of an individual agent's: identity and
 * mandate, plus incorporation and proof of association. A superset is a branch
 * in a form rather than a role, which is why `SUPPLY_ROLES` has two values and
 * `WORKSPACE_KINDS` has this one, and why this file sits beside the agent's
 * rather than duplicating it. This codebase already implements exactly that
 * shape twice, in `components/verification/kyc.ts` `stepsFor` and in
 * `lib/agent/application.ts`.
 *
 * ---------------------------------------------------------------------------
 * LASRERA IS A FIELD. IT IS NOT A GATE AND IT IS NOT A WARNING.
 *
 * The render draws "Required for Lagos" under it. That line does not ship, and
 * the reason is recorded rather than assumed: `lasrera.lagosstate.gov.ng` was
 * refused by this build's egress proxy and every claim about what the register
 * requires, of whom, and what ignoring it costs reaches this repository
 * through a search index's summary of a page nobody read. A form that tells a
 * Nigerian firm what the law demands, on that evidence, would be the platform
 * giving legal advice it has not checked.
 *
 * So the field is optional in the form, optional in the schema, optional in
 * the database, and the hint beside it says what the field is FOR: a renter
 * looking for a firm that holds one will be able to find you by it. That is
 * the honest treatment the research file argues for, a field plus a dated
 * attestation plus a search side filter, and never a hard gate that would
 * empty the supply side of the one city that matters most. The ledger's
 * needs-the-founder section holds the figures for a lawyer.
 *
 * ---------------------------------------------------------------------------
 * THE TEAM SCREEN DECLARES COLLEAGUES. IT DOES NOT CREATE STAFF.
 *
 * `GOVERNING-05` screen three draws two members carrying a Verified mark. At
 * the moment this screen appears the firm itself has not been checked and
 * neither has anybody on it, so no row here carries a mark of any kind: they
 * are people the applicant has NAMED. The real roster is `firm_members`, it is
 * not built yet, and when it is it will be filled by invitation and acceptance
 * rather than by a form, because a membership is a fact about two parties.
 * Letting an application create staff is the letterhead failure this form
 * exists to catch.
 */

export function FirmRegisterForm({
  t,
  startAt = 0,
}: {
  t: RegisterCopy;
  /** The preview harness only. See the note on the owner form. */
  startAt?: number;
}) {
  const leave = useBack("/profile/setup");
  const copy = t.supply.register;
  const mine = copy.firm;
  const steps = REGISTER_STEPS.firm.length;
  const [batchId] = useState(newBatchId);

  const [step, setStep] = useState(startAt);
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [rcNumber, setRcNumber] = useState("");
  const [officeAddress, setOfficeAddress] = useState("");
  const [lasreraNumber, setLasreraNumber] = useState("");
  const [proof, setProof] = useState<AssociationProof | null>(null);
  const [principalEmail, setPrincipalEmail] = useState("");
  const [letter, setLetter] = useState<UploadState | null>(null);
  const [team, setTeam] = useState<{ name: string; email: string }[]>([]);
  const [draftName, setDraftName] = useState("");
  const [draftEmail, setDraftEmail] = useState("");

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
    if (step === 0) {
      return (
        fullName.trim().length < 2 ||
        businessName.trim().length < 2 ||
        rcNumber.trim().length < 2 ||
        officeAddress.trim().length < 4
      );
    }
    if (step === 1) return proof === null;
    /* The team screen never blocks. A firm with nobody added yet is the state
       every firm starts in, and the screen says so rather than refusing. It
       waits only for the two ticks (ruling 6). */
    if (step === 2) return !acceptTerms || !acceptPay;
    return false;
  }

  function addPerson() {
    const name = draftName.trim();
    if (name.length < 2 || team.length >= MAX_DECLARED_TEAM) return;
    setTeam([...team, { name, email: draftEmail.trim() }]);
    setDraftName("");
    setDraftEmail("");
  }

  function forward() {
    setScreenError(null);
    if (step < 2) {
      setStep(step + 1);
      return;
    }
    if (proof === null) return;
    startTransition(async () => {
      const result = await submitSupplyRegistration({
        role: "firm",
        fullName: fullName.trim(),
        businessName: businessName.trim(),
        rcNumber: rcNumber.trim(),
        officeAddress: officeAddress.trim(),
        lasreraNumber: lasreraNumber.trim(),
        associationProof: proof,
        principalEmail: principalEmail.trim(),
        letterPath: letter?.path ?? "",
        team,
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
    });
  }

  if (step === 3 && filed) {
    return (
      <>
        <FirmDoneScreen t={t} filed={filed} />
        <RegistrationFiledSheet reference={filed.reference} copy={t.success} />
      </>
    );
  }

  const screen = [
    {
      heading: mine.details.title,
      sub: mine.details.sub,
      body: (
        <div className="grid gap-row">
          {/* The glass building the render stands at the top of this screen,
              on its pool of brand light. It carries no text and is not a
              control. */}
          <div className="nf-regobject nf-regobject--inline">
            <BrandIcon name="cluster-home" size={176} priority />
          </div>
          <RegFieldGroup>
            <RegField>
              <TextField
                label={mine.details.name}
                placeholder={mine.details.namePlaceholder}
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required
                {...(errors.businessName ? { error: errors.businessName } : {})}
              />
            </RegField>
            <RegField>
              <TextField
                label={mine.details.rc}
                placeholder={mine.details.rcPlaceholder}
                value={rcNumber}
                onChange={(e) => setRcNumber(e.target.value)}
                required
                {...(errors.rcNumber ? { error: errors.rcNumber } : {})}
              />
            </RegField>
            {/* The pin inside the well is the render's own: `GOVERNING-05`
                screen one draws it at the right of the office address and
                nowhere else on the screen. It is decoration on a field that
                already says what it wants, so it is hidden from the reader who
                is being read to rather than announced as a second thing. */}
            <RegField>
              <TextField
                label={mine.details.office}
                placeholder={mine.details.officePlaceholder}
                value={officeAddress}
                onChange={(e) => setOfficeAddress(e.target.value)}
                required
                trailing={
                  <span aria-hidden="true">
                    <UiIcon name="location" size={20} />
                  </span>
                }
                {...(errors.officeAddress ? { error: errors.officeAddress } : {})}
              />
            </RegField>
            <RegField>
              <TextField
                label={mine.details.yourName}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                required
                {...(errors.fullName ? { error: errors.fullName } : {})}
              />
            </RegField>
            {/*
              OPTIONAL IN THE FORM, IN THE SCHEMA AND IN THE DATABASE, and the
              hint says what the field is for rather than what the law is. See
              the note at the head of this file.

              THE TAG AND THE NOTE ARE BOTH THE RENDER'S. `GOVERNING-05` draws
              "Optional" in the container's top right corner and a line with a
              small round glyph under the well. The corner and the glyph are the
              target; the capsule is not, and the tag ships at 0.250. The note
              carries the hint the field already had, so nothing new is claimed
              and no statutory word is printed.
            */}
            <RegField optional={copy.optional} note={mine.details.lasreraHint}>
              <TextField
                label={mine.details.lasrera}
                value={lasreraNumber}
                onChange={(e) => setLasreraNumber(e.target.value)}
                {...(errors.lasreraNumber ? { error: errors.lasreraNumber } : {})}
              />
            </RegField>
          </RegFieldGroup>
        </div>
      ),
    },
    {
      heading: mine.association.title,
      sub: mine.association.sub,
      body: (
        <div className="grid gap-group">
          <ul className="grid gap-inline" role="radiogroup" aria-label={mine.association.title}>
            {ASSOCIATION_PROOFS.map((route) => {
              const chosen = proof === route;
              return (
                <li key={route} role="presentation">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={chosen}
                    onClick={() => setProof(route)}
                    className="nf-door"
                    data-on={chosen || undefined}
                  >
                    <IconPlate size="md" tone={chosen ? "brand" : "neutral"} className="nf-door__mark">
                      {/* A letter carrying a signature, or the ticked seal:
                          what each row asks for. */}
                      <UiIcon name={route === "letter" ? "pencil" : "circle-check"} size={20} />
                    </IconPlate>
                    <span className="min-w-0 flex-1 text-left">
                      <span className={`block ${TYPE.rowTitle}`}>
                        {route === "letter"
                          ? mine.association.letterTitle
                          : mine.association.principalTitle}
                      </span>
                      <span className={`mt-inline-tight block ${TYPE.rowMeta}`}>
                        {route === "letter"
                          ? mine.association.letterBody
                          : mine.association.principalBody}
                      </span>
                    </span>
                    <span className="nf-choicemark" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Only the chosen route's field appears. Asking for both would
              refuse every honest applicant, which is the same argument the
              schema's cross field rule makes on the server. */}
          {proof === "letter" ? (
            <UploadCard
              t={t}
              object="doc-shield"
              title={mine.association.letterTitle}
              body={mine.association.letterBody}
              slot="association"
              batchId={batchId}
              value={letter}
              onChange={setLetter}
              {...(errors.letterPath ? { error: errors.letterPath } : {})}
            />
          ) : null}
          {proof === "principal" ? (
            <RegFieldGroup>
              <RegField>
                <TextField
                  label={mine.association.principalEmail}
                  value={principalEmail}
                  onChange={(e) => setPrincipalEmail(e.target.value)}
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  required
                  {...(errors.principalEmail ? { error: errors.principalEmail } : {})}
                />
              </RegField>
            </RegFieldGroup>
          ) : null}
        </div>
      ),
    },
    {
      heading: mine.team.title,
      sub: mine.team.sub,
      body: (
        <div className="grid gap-group">
          {team.length === 0 ? (
            <p className={`${TYPE.body} max-w-[52ch]`}>{mine.team.none}</p>
          ) : (
            <ul className="grid gap-inline">
              {team.map((person, index) => (
                <li key={`${person.name}-${index}`} className="nf-door nf-door--compact">
                  {/* ROUND, and it is the reference set's own standing
                      exception rather than one being taken: "the round avatars
                      stay round" is written into its translation rules in as
                      many words. `GOVERNING-05` screen three draws a
                      photograph here; nobody has uploaded one, so the plate
                      carries the person glyph and never a made up face. */}
                  <span className="nf-door__mark nf-door__mark--avatar" aria-hidden="true">
                    <UiIcon name="user" size="md" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block ${TYPE.rowTitle}`}>{person.name}</span>
                    {person.email ? (
                      <span className={`mt-inline-tight block ${TYPE.rowMeta}`}>
                        {person.email}
                      </span>
                    ) : null}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setTeam(team.filter((_, i) => i !== index))}
                  >
                    {mine.team.remove}
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {team.length < MAX_DECLARED_TEAM ? (
            <div className="grid gap-row">
              <RegFieldGroup>
                <RegField>
                  <TextField
                    label={mine.team.name}
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                  />
                </RegField>
                <RegField optional={copy.optional}>
                  <TextField
                    label={mine.team.email}
                    value={draftEmail}
                    onChange={(e) => setDraftEmail(e.target.value)}
                    type="email"
                    inputMode="email"
                  />
                </RegField>
              </RegFieldGroup>
              <Button
                variant="secondary"
                size="md"
                full
                leadingIcon="plus"
                onClick={addPerson}
                disabled={draftName.trim().length < 2}
              >
                {mine.team.add}
              </Button>
            </div>
          ) : null}

          <CalmPanel body={mine.team.each} />
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

/**
 * SCREEN FOUR. The render's own words are true here: the firm IS under review
 * and nothing on the screen says a check has finished.
 *
 * "Under review" and the timing label are drawn as the same rectangle, at
 * 2.75rem, so their radius reads as a rectangle rather than as the capsule the
 * render draws.
 *
 * Exported so the preview harness can draw the real screen.
 */
export function FirmDoneScreen({
  t,
  filed,
}: {
  t: RegisterCopy;
  filed: { reference: string; attached: boolean };
}) {
  const router = useRouter();
  const copy = t.supply.register;
  const mine = copy.firm;
  const steps = REGISTER_STEPS.firm.length;

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
        object="cluster-home"
        heading={mine.done.title}
        sub={mine.done.sub}
        filedLine={copy.filedAs.replace("{reference}", filed.reference)}
        whatNext={copy.whatNext}
        lines={[mine.done.nextOne, mine.done.nextTwo, mine.done.nextThree]}
        timing={copy.reviewDaysFirm}
      >
        {filed.attached ? null : <CalmPanel body={copy.documentsMissed} />}
      </RegisterDone>
    </RegisterShell>
  );
}
