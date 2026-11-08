"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Celebration } from "@/components/roommates/Celebrate";
import { ChoiceChips } from "@/components/roommates/ChoiceChips";
import { budgetText, fill, lifestyleFacts, moveInText, naira, placeText, type RoommatesCopy } from "@/components/roommates/format";
import { SchoolPicker } from "@/components/roommates/SchoolPicker";
import { STATE_OPTIONS, stateName } from "@/components/roommates/states";
import { Button, ButtonLink } from "@/components/ui/Button";
import { SelectField, TextArea, TextField } from "@/components/ui/Field";
import { NairaField } from "@/components/ui/NairaField";
import { OptionCards } from "@/components/ui/OptionCards";
import { Segmented } from "@/components/ui/Segmented";
import { StepFrame, type StepSaveState } from "@/components/ui/StepFrame";
import { Switch } from "@/components/ui/Switch";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { useScopedCopy } from "@/lib/i18n/copy-scope";
import { saveRoommateProfile } from "@/lib/features/roommates/actions";
import {
  FURNISHED_PREFS,
  GENDERS,
  GENDER_PREFS,
  INTENTS,
  LIFESTYLE_KEYS,
  LIFESTYLE_OPTIONS,
  LIFE_STAGES,
  LIMITS,
  MOVE_IN_FLEX,
  PERIODS,
  ROOMMATES_ROUTES,
  ROOM_PREFS,
  canPublishProfile,
  completenessPercent,
  profileGaps,
  type InstitutionRef,
  type Intent,
  type LifeStage,
  type Lifestyle,
  type MyRoommateProfile,
} from "@/lib/features/roommates/model";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { feedback } from "@/lib/ui/feedback";
import { banner } from "@/lib/ui/toast";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

type Draft = Omit<MyRoommateProfile, "status">;
const TOTAL = 7;

const INTENT_ICON: Record<Intent, UiIconName> = { find_roommate: "users", find_room: "bed", offer_room: "door", find_together: "circle-people" };
const STAGE_ICON: Record<LifeStage, UiIconName> = { student: "id-card", corps_member: "certificate", graduate: "file-check", professional: "briefcase", other: "user" };

/** The max budget shortcuts, by period, in kobo. Shortcuts only: any figure can be typed. */
const BUDGET_STEPS: Record<"month" | "year", number[]> = {
  month: [3_000_000, 5_000_000, 8_000_000, 12_000_000, 20_000_000],
  year: [30_000_000, 50_000_000, 80_000_000, 120_000_000, 200_000_000],
};

/**
 * THE ROOMMATE PROFILE, ONE IDEA PER SCREEN (StepFrame): what brings you
 * here, where and when, the budget, about you, how you live, preferences,
 * review. Every Continue saves the draft to the account (never live until
 * the review's publish); Back always works. Editing a profile opens on the
 * review, and any section's Edit comes back to it.
 */
export function ProfileFlow({
  initial,
  status,
  exists,
  hasPhoto,
  schools,
}: {
  initial: Draft;
  status: MyRoommateProfile["status"];
  exists: boolean;
  hasPhoto: boolean;
  schools: InstitutionRef[];
}) {
  const copy = useScopedCopy("roommates");
  const O = copy.ui.onboarding;
  const F = copy.ui.flow;
  const router = useRouter();
  const [p, setP] = useState<Draft>(initial);
  const [step, setStep] = useState(exists ? TOTAL : 1);
  const [dir, setDir] = useState<"forward" | "back">("forward");
  const [save, setSave] = useState<StepSaveState>("idle");
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [toReview, setToReview] = useState(exists);
  const [live, setLive] = useState(false);
  const [pending, start] = useSafeTransition();
  const patch = (x: Partial<Draft>) => {
    setP((cur) => ({ ...cur, ...x }));
    if (save === "saved") setSave("idle");
  };
  const lifePatch = (x: Partial<Lifestyle>) => patch({ lifestyle: { ...p.lifestyle, ...x } });

  const goto = (n: number) => {
    setDir(n > step ? "forward" : "back");
    setStep(n);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  };

  /** Save the draft, then move on. A refused field stays on this step with its red edge and the banner. */
  const next = () =>
    start(async () => {
      setSave("saving");
      try {
        const result = await saveRoommateProfile(p);
        if (!result.ok) {
          setSave("error");
          feedback("error");
          if (result.fieldErrors && Object.keys(result.fieldErrors).length) {
            setProblems(result.fieldErrors);
            banner.error(result.error);
            return;
          }
          banner.error(result.error, { retry: next });
        } else {
          setSave("saved");
          setProblems({});
        }
      } catch (error) {
        setSave("error");
        if (!tapFailedOffline(error)) throw error;
      }
      goto(toReview ? TOTAL : step + 1);
    });

  const publish = () =>
    start(async () => {
      try {
        const result = await saveRoommateProfile(p, { publish: status === "draft" });
        if (!result.ok) {
          feedback("error");
          if (result.fieldErrors) setProblems(result.fieldErrors);
          banner.error(result.error, { retry: publish });
          return;
        }
        feedback("confirm");
        setSave("saved");
        if (status !== "draft") {
          banner.success(O.savedLive);
          router.push(ROOMMATES_ROUTES.home);
          router.refresh();
          return;
        }
        banner.success(copy.onboarding.live);
        setLive(true);
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });

  const back = step > 1 ? () => goto(toReview && step !== TOTAL ? TOTAL : step - 1) : undefined;
  const words = { saving: F.saving, saved: F.saved, device: F.device, error: F.notSaved };
  const common = {
    total: TOTAL,
    eyebrow: O.eyebrow,
    closeHref: ROOMMATES_ROUTES.home,
    closeLabel: F.close,
    backLabel: copy.ui.back,
    direction: dir,
    save,
    saveWords: words,
    stepLabel: fill(F.stepOf, { n: step, total: TOTAL }),
    onBack: back,
  } as const;
  const cont = (disabled = false) => ({ label: toReview ? F.backToReview : F.next, onClick: next, loading: pending, disabled: disabled || pending, testId: "profile-next" });

  if (live) {
    return (
      <Celebration
        testId="profile-live"
        art="team"
        title={copy.onboarding.live}
        body={copy.onboarding.liveBody}
        actions={
          <>
            <ButtonLink href={ROOMMATES_ROUTES.discover} variant="primary" size="lg" full arrow glow data-testid="profile-live-discover">
              {O.liveCta}
            </ButtonLink>
            <ButtonLink href={ROOMMATES_ROUTES.home} variant="secondary" size="lg" full>
              {O.liveSecondary}
            </ButtonLink>
          </>
        }
      />
    );
  }

  if (step === 1) {
    return (
      <StepFrame {...common} step={1} title={O.intentsTitle} subtitle={O.intentsBody} primary={cont(p.intents.length === 0)} testId="profile-step-intents">
        <div className="nf-rmf-cards" role="group" aria-label={O.intentsTitle}>
          {INTENTS.map((i) => {
            const on = p.intents.includes(i);
            return (
              <button
                key={i}
                type="button"
                className="nf-rmf-card"
                aria-pressed={on}
                onClick={() => {
                  feedback("select");
                  patch({ intents: on ? p.intents.filter((x) => x !== i) : [...p.intents, i] });
                }}
              >
                <span className="nf-rmf-card__glyph" aria-hidden="true">
                  <UiIcon name={INTENT_ICON[i]} size={24} />
                </span>
                <span className="nf-rmf-card__title">{copy.journeys[i].title}</span>
                <span className="nf-rmf-card__body">{copy.journeys[i].body}</span>
                <span className="nf-rmf-card__tick" aria-hidden="true">
                  <UiIcon name="check" size={16} />
                </span>
              </button>
            );
          })}
        </div>
      </StepFrame>
    );
  }

  if (step === 2) {
    return (
      <StepFrame {...common} step={2} title={O.whereTitle} subtitle={O.whereBody} primary={cont(!p.city.trim())} testId="profile-step-where">
        <div className="nf-rmf-stack">
          <Card icon="pin" title={copy.profile.lookingIn}>
            <SelectField label={O.state} value={p.stateCode ?? ""} onChange={(e) => patch({ stateCode: e.target.value || null })} error={problems.stateCode}>
              <option value="">{copy.ui.discover.anyState}</option>
              {STATE_OPTIONS.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </SelectField>
            <TextField label={O.city} required value={p.city} maxLength={60} placeholder={O.cityPlaceholder} onChange={(e) => patch({ city: e.target.value })} error={problems.city} />
            <AreaPicker areas={p.areas} onChange={(areas) => patch({ areas })} />
          </Card>
          <Card icon="calendar-check" title={O.moveIn}>
            <ChoiceChips label={O.moveIn} value={p.moveInFlex} options={MOVE_IN_FLEX.map((v) => ({ value: v, label: copy.moveInFlex[v] }))} onChange={(v) => patch({ moveInFlex: v ?? "flexible", ...(v === "fixed" ? {} : { moveInOn: v === "asap" ? null : p.moveInOn }) })} />
            {p.moveInFlex === "fixed" || p.moveInOn ? (
              <TextField label={O.moveInDate} type="date" value={p.moveInOn ?? ""} onChange={(e) => patch({ moveInOn: e.target.value || null })} error={problems.moveInOn} />
            ) : null}
          </Card>
        </div>
      </StepFrame>
    );
  }

  if (step === 3) {
    return (
      <StepFrame {...common} step={3} title={O.budgetTitle} subtitle={O.budgetBody} primary={cont(p.budgetMaxMinor === null)} testId="profile-step-budget">
        <div className="nf-rmf-stack">
          <Card icon="wallet" title={copy.profile.budget}>
            <Segmented
              variant="solid"
              label={copy.ui.discover.per}
              semantics="radio"
              full
              value={p.budgetPeriod}
              options={PERIODS.map((x) => ({ value: x, label: copy.periods[x] }))}
              onChange={(x) => patch({ budgetPeriod: x })}
            />
            <BudgetRange min={p.budgetMinMinor} max={p.budgetMaxMinor} period={p.budgetPeriod} />
            <div className="nf-rmf-pair">
              <NairaField label={O.budgetMin} value={p.budgetMinMinor ? String(Math.round(p.budgetMinMinor / 100)) : ""} onValueChange={(v) => patch({ budgetMinMinor: v ? Math.round(Number(v) * 100) : null })} error={problems.budgetMinMinor} />
              <NairaField label={O.budgetMax} required value={p.budgetMaxMinor ? String(Math.round(p.budgetMaxMinor / 100)) : ""} onValueChange={(v) => patch({ budgetMaxMinor: v ? Math.round(Number(v) * 100) : null })} error={problems.budgetMaxMinor} />
            </div>
            <ChoiceChips
              label={O.budgetMax}
              value={BUDGET_STEPS[p.budgetPeriod].includes(p.budgetMaxMinor ?? -1) ? p.budgetMaxMinor : null}
              options={BUDGET_STEPS[p.budgetPeriod].map((v) => ({ value: v, label: `${naira(v)}${copy.perPeriod[p.budgetPeriod]}` }))}
              onChange={(v) => {
                if (v !== null) patch({ budgetMaxMinor: v });
              }}
            />
            <p className="nf-rm-note">
              <UiIcon name="info" size={16} />
              {O.budgetHint}
            </p>
          </Card>
        </div>
      </StepFrame>
    );
  }

  if (step === 4) {
    return (
      <StepFrame {...common} step={4} title={O.aboutTitle} subtitle={O.aboutBody} primary={cont()} secondary={{ label: F.skip, onClick: next, disabled: pending }} testId="profile-step-about">
        <div className="nf-rmf-stack">
          <OptionCards
            label={O.lifeStage}
            columns={2}
            value={p.lifeStage}
            options={LIFE_STAGES.map((s) => ({ value: s, label: copy.lifeStages[s], icon: STAGE_ICON[s] }))}
            onChange={(v) => {
              feedback("select");
              patch({ lifeStage: v as LifeStage });
            }}
          />
          {p.lifeStage === "student" || p.lifeStage === "graduate" ? (
            <Card icon="id-card" title={O.school}>
              <SchoolPicker schools={schools} value={p.institutionId} onChange={(id) => patch({ institutionId: id })} />
              <Switch label={O.showSchool} checked={p.institutionVisible} onCheckedChange={(v) => patch({ institutionVisible: v })} />
              {p.lifeStage === "student" ? (
                <div className="nf-rmf-pair">
                  <TextField label={O.course} optionalText={F.optional} value={p.course} maxLength={80} onChange={(e) => patch({ course: e.target.value })} />
                  <TextField label={O.level} optionalText={F.optional} value={p.studyLevel} maxLength={30} placeholder={O.levelPlaceholder} onChange={(e) => patch({ studyLevel: e.target.value })} />
                </div>
              ) : null}
            </Card>
          ) : null}
          {p.lifeStage === "corps_member" ? (
            <Card icon="certificate" title={O.nyscState}>
              <SelectField label={O.nyscState} hideLabel value={p.nyscStateCode ?? ""} onChange={(e) => patch({ nyscStateCode: e.target.value || null })}>
                <option value="">{copy.ui.discover.anyState}</option>
                {STATE_OPTIONS.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </SelectField>
            </Card>
          ) : null}
          {p.lifeStage && p.lifeStage !== "student" ? (
            <Card icon="briefcase" title={O.workplace}>
              <TextField label={O.workplace} hideLabel optionalText={F.optional} value={p.workplace} maxLength={80} onChange={(e) => patch({ workplace: e.target.value })} />
              <Switch label={O.showWork} checked={p.workplaceVisible} onCheckedChange={(v) => patch({ workplaceVisible: v })} />
            </Card>
          ) : null}
          <TextArea label={O.intro} value={p.intro} maxLength={LIMITS.introMax} rows={5} placeholder={O.introPlaceholder} onChange={(e) => patch({ intro: e.target.value })} error={problems.intro} />
        </div>
      </StepFrame>
    );
  }

  if (step === 5) {
    return (
      <StepFrame {...common} step={5} title={O.liveTitle} subtitle={O.liveBody} primary={cont()} secondary={{ label: F.skip, onClick: next, disabled: pending }} testId="profile-step-lifestyle">
        <div className="nf-rmf-stack">
          {LIFESTYLE_KEYS.map((key) => {
            const q = copy.lifestyle[key] as { label: string; options: Record<string, string> };
            const opts = (LIFESTYLE_OPTIONS[key] as readonly (string | number)[]).map((v) => ({ value: v, label: q.options[String(v)] ?? String(v) }));
            return (
              <Card key={key} icon={LIFE_ICON[key]} title={q.label}>
                <ChoiceChips label={q.label} value={(p.lifestyle[key] as string | number | null) ?? null} options={opts} onChange={(v) => lifePatch({ [key]: v } as Partial<Lifestyle>)} />
              </Card>
            );
          })}
        </div>
      </StepFrame>
    );
  }

  if (step === 6) {
    return (
      <StepFrame {...common} step={6} title={O.prefsTitle} subtitle={O.prefsBody} primary={cont()} testId="profile-step-prefs">
        <div className="nf-rmf-stack">
          <Card icon="door" title={O.roomPref}>
            <ChoiceChips label={O.roomPref} value={p.roomPref} options={ROOM_PREFS.map((v) => ({ value: v, label: copy.roomPref[v] }))} onChange={(v) => patch({ roomPref: v })} />
          </Card>
          <Card icon="bed" title={O.furnishedPref}>
            <ChoiceChips label={O.furnishedPref} value={p.furnishedPref} options={FURNISHED_PREFS.map((v) => ({ value: v, label: copy.furnishedPref[v] }))} onChange={(v) => patch({ furnishedPref: v })} />
          </Card>
          <Card icon="users" title={O.householdSize}>
            <ChoiceChips
              label={O.householdSize}
              anyLabel={O.householdAny}
              value={p.householdSize}
              options={[2, 3, 4, 5].map((n) => ({ value: n, label: n === 5 ? "5+" : String(n) }))}
              onChange={(v) => patch({ householdSize: v })}
            />
          </Card>
          <Card icon="circle-people" title={O.genderPref}>
            <ChoiceChips label={O.genderPref} value={p.genderPref} options={GENDER_PREFS.map((v) => ({ value: v, label: copy.genderPref[v] }))} onChange={(v) => patch({ genderPref: v ?? "any" })} />
            <ChoiceChips label={O.ownGender} anyLabel={O.ownGenderNone} value={p.gender} options={GENDERS.map((v) => ({ value: v, label: copy.gender[v] }))} onChange={(v) => patch({ gender: v, ...(v === null ? { genderVisible: false } : {}) })} />
            {p.gender ? <Switch label={O.showGender} checked={p.genderVisible} onCheckedChange={(v) => patch({ genderVisible: v })} /> : null}
            <p className="nf-rm-note">
              <UiIcon name="lock" size={16} />
              {O.genderLine}
            </p>
          </Card>
        </div>
      </StepFrame>
    );
  }

  /* Review */
  const pct = completenessPercent({ ...p, status }, hasPhoto);
  const gaps = profileGaps({ ...p, status }, hasPhoto);
  const ready = canPublishProfile({ ...p, status });
  const school = schools.find((s) => s.id === p.institutionId) ?? null;
  const life = lifestyleFacts(p.lifestyle, copy).map((f) => f.value);
  const edit = (n: number) => () => {
    setToReview(true);
    goto(n);
  };
  return (
    <StepFrame
      {...common}
      step={TOTAL}
      title={O.reviewTitle}
      subtitle={O.reviewBody}
      onBack={() => goto(6)}
      primary={{ label: status === "draft" ? copy.onboarding.publish : O.saveChanges, onClick: publish, loading: pending, disabled: !ready || pending, testId: "profile-publish" }}
      notice={ready ? undefined : <p className="nf-rmf-notice">{O.missingToPublish}</p>}
      testId="profile-step-review"
    >
      <div className="nf-rmf-stack">
        <div className="nf-rm-panel nf-rmf-meter">
          <div className="nf-rmf-meter__head">
            <span className="nf-rmf-meter__pct">{fill(copy.ui.completeness, { n: pct })}</span>
          </div>
          <div className="nf-rmp-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={fill(copy.ui.completeness, { n: pct })}>
            <span className="nf-rmp-progress__fill" style={{ transform: `scaleX(${pct / 100})` }} />
          </div>
          {gaps.length ? (
            <ul className="nf-rmf-gaps">
              {gaps.map((g) => (
                <li key={g}>
                  <UiIcon name="plus" size={14} />
                  {copy.ui.gaps[g]}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <ReviewRow title={O.intentsTitle} value={p.intents.map((i) => copy.intents[i]).join(" · ")} onEdit={edit(1)} t={copy} />
        <ReviewRow title={O.whereTitle} value={[placeText(p.areas.join(", "), p.city, stateName(p.stateCode)), moveInText(p.moveInOn, p.moveInFlex, copy)].filter(Boolean).join(" · ")} onEdit={edit(2)} t={copy} />
        <ReviewRow title={copy.profile.budget} value={budgetText({ minMinor: p.budgetMinMinor, maxMinor: p.budgetMaxMinor, period: p.budgetPeriod }, copy) ?? ""} onEdit={edit(3)} t={copy} />
        <ReviewRow
          title={O.aboutTitle}
          value={[p.lifeStage ? copy.lifeStages[p.lifeStage] : null, school?.name ?? null, p.workplace || null].filter(Boolean).join(" · ")}
          extra={p.intro ? <p className="nf-rmf-review__intro">{p.intro}</p> : null}
          onEdit={edit(4)}
          t={copy}
        />
        <ReviewRow title={O.liveTitle} value={life.join(" · ")} onEdit={edit(5)} t={copy} />
        <ReviewRow
          title={O.prefsTitle}
          value={[p.roomPref ? copy.roomPref[p.roomPref] : null, p.furnishedPref ? copy.furnishedPref[p.furnishedPref] : null, p.householdSize ? fill(copy.ui.profile.household, { n: p.householdSize }) : null, copy.genderPref[p.genderPref]].filter(Boolean).join(" · ")}
          onEdit={edit(6)}
          t={copy}
        />
      </div>
    </StepFrame>
  );
}

const LIFE_ICON: Record<(typeof LIFESTYLE_KEYS)[number], UiIconName> = {
  cleanliness: "droplet",
  social: "circle-people",
  sleep: "moon",
  smoking: "shield-stop",
  pets: "heart",
  guests: "users",
  cooking: "utensils",
  schedule: "clock",
};

function Card({ icon, title, children }: { icon: UiIconName; title: string; children: ReactNode }) {
  return (
    <section className="nf-rmf-pcard">
      <h2 className="nf-rmf-pcard__title">
        <span className="nf-rm-plate" aria-hidden="true">
          <UiIcon name={icon} size={18} />
        </span>
        {title}
      </h2>
      <div className="nf-rmf-pcard__body">{children}</div>
    </section>
  );
}

function ReviewRow({ title, value, extra, onEdit, t: copy }: { title: string; value: string; extra?: ReactNode; onEdit: () => void; t: RoommatesCopy }) {
  return (
    <section className="nf-rmf-review">
      <div className="nf-rmf-review__head">
        <h2 className="nf-rmf-review__title">{title}</h2>
        <Button variant="quiet" size="sm" leadingIcon="pencil" onClick={onEdit}>
          {copy.ui.onboarding.edit}
        </Button>
      </div>
      <p className="nf-rmf-review__value" data-empty={!value || undefined}>
        {value || copy.ui.onboarding.notSet}
      </p>
      {extra}
    </section>
  );
}

function AreaPicker({ areas, onChange }: { areas: string[]; onChange: (a: string[]) => void }) {
  const copy = useScopedCopy("roommates");
  const O = copy.ui.onboarding;
  const [text, setText] = useState("");
  const add = () => {
    const v = text.trim().slice(0, 60);
    if (!v || areas.some((a) => a.toLowerCase() === v.toLowerCase()) || areas.length >= LIMITS.areasMax) return;
    feedback("select");
    onChange([...areas, v]);
    setText("");
  };
  return (
    <div className="nf-rmf-areas">
      <div className="nf-rmf-addrow">
        <TextField
          label={O.areas}
          hint={O.areasHint}
          value={text}
          maxLength={60}
          placeholder={O.areaPlaceholder}
          enterKeyHint="done"
          disabled={areas.length >= LIMITS.areasMax}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button variant="secondary" size="md" leadingIcon="plus" onClick={add} disabled={!text.trim() || areas.length >= LIMITS.areasMax}>
          {O.addArea}
        </Button>
      </div>
      {areas.length ? (
        <ul className="nf-rmf-tags">
          {areas.map((a) => (
            <li key={a}>
              <span>{a}</span>
              <button type="button" aria-label={fill(O.removeArea, { area: a })} onClick={() => onChange(areas.filter((x) => x !== a))}>
                <UiIcon name="close" size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** The range, drawn: where the lowest and highest sit on the period's scale, with a value tag on each (reference 2). */
function BudgetRange({ min, max, period }: { min: number | null; max: number | null; period: "month" | "year" }) {
  const copy = useScopedCopy("roommates");
  const top = BUDGET_STEPS[period][BUDGET_STEPS[period].length - 1]! * 1.25;
  const scale = Math.max(top, (max ?? 0) * 1.1);
  const lo = Math.max(0, Math.min(1, (min ?? 0) / scale));
  const hi = Math.max(lo, Math.min(1, (max ?? 0) / scale));
  return (
    <div className="nf-rmf-range" aria-hidden="true">
      <div className="nf-rmf-range__track">
        <span className="nf-rmf-range__fill" style={{ insetInlineStart: `${lo * 100}%`, insetInlineEnd: `${(1 - hi) * 100}%` }} />
        {max !== null ? <span className="nf-rmf-range__knob" style={{ insetInlineStart: `${hi * 100}%` }} /> : null}
        <span className="nf-rmf-range__knob" style={{ insetInlineStart: `${lo * 100}%` }} />
      </div>
      <div className="nf-rmf-range__tags">
        <span className="nf-rmf-range__tag">{naira(min ?? 0)}</span>
        {max ? <span className="nf-rmf-range__tag">{`${naira(max)}${copy.perPeriod[period]}`}</span> : null}
      </div>
    </div>
  );
}

