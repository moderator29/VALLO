"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { STATE_OPTIONS } from "@/components/roommates/states";
import { FieldProblem } from "@/components/ui/FieldProblem";
import { State } from "@/components/ui/State";
import { StepFrame } from "@/components/ui/StepFrame";
import { createRoommateGroup } from "@/lib/features/roommates/actions";
import { LIMITS, ROOMMATES_ROUTES, type Period } from "@/lib/features/roommates/model";
import { useScopedCopy } from "@/lib/i18n/copy-scope";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { feedback } from "@/lib/ui/feedback";
import { banner } from "@/lib/ui/toast";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

import { displayOf, koboOf, nairaDisplay } from "./money";

type Prefill = {
  stateCode: string | null;
  city: string;
  areas: string[];
  institutionId: string | null;
  budgetMinMinor: number | null;
  budgetMaxMinor: number | null;
  budgetPeriod: Period;
  moveInOn: string | null;
  sizeTarget: number | null;
};

type Draft = {
  name: string;
  intro: string;
  visibility: "open" | "private";
  stateCode: string;
  city: string;
  areas: string;
  institutionId: string;
  bedrooms: number | null;
  sizeTarget: number;
  budgetMin: string;
  budgetMax: string;
  budgetPeriod: Period;
  moveInOn: string;
};

/**
 * START A GROUP (FE-B): six short steps on StepFrame (name and intro, who
 * can find it, where, the home, money and move-in, review), then the group
 * page. Field problems keep the red edge and say their words in the banner.
 */
export function NewGroupFlow({ live, schools, prefill }: { live: boolean; schools: { id: string; name: string }[]; prefill: Prefill | null }) {
  const R = useScopedCopy("roommates");
  const C = R.groupsX.create;
  const router = useRouter();
  const [pending, start] = useSafeTransition();
  const [step, setStep] = useState(1);
  const [dir, setDir] = useState<"forward" | "back">("forward");
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [d, setD] = useState<Draft>({
    name: "",
    intro: "",
    visibility: "open",
    stateCode: prefill?.stateCode ?? "",
    city: prefill?.city ?? "",
    areas: (prefill?.areas ?? []).join(", "),
    institutionId: prefill?.institutionId ?? "",
    bedrooms: null,
    sizeTarget: Math.min(8, Math.max(2, prefill?.sizeTarget ?? 2)),
    budgetMin: displayOf(prefill?.budgetMinMinor ?? null),
    budgetMax: displayOf(prefill?.budgetMaxMinor ?? null),
    budgetPeriod: prefill?.budgetPeriod ?? "year",
    moveInOn: prefill?.moveInOn ?? "",
  });
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const total = 6;
  const back = step > 1 ? () => { setDir("back"); setStep(step - 1); } : undefined;
  const forward = () => { setDir("forward"); setStep(step + 1); };
  const common = { total, onBack: back, closeHref: ROOMMATES_ROUTES.groups, direction: dir } as const;

  if (!live) {
    return <State kind="empty" title={C.title} body={R.notOpen} primary={{ href: ROOMMATES_ROUTES.home, label: R.title }} />;
  }

  const field = (key: string) => ({
    "aria-invalid": problems[key] ? true : undefined,
    "aria-describedby": problems[key] ? `rm-ng-${key}-problem` : undefined,
  });
  const problem = (key: string) => <FieldProblem id={`rm-ng-${key}-problem`} message={problems[key]} />;

  const create = () =>
    start(async () => {
      try {
        const result = await createRoommateGroup({
          name: d.name,
          intro: d.intro,
          visibility: d.visibility,
          stateCode: d.stateCode || null,
          city: d.city,
          areas: d.areas.split(",").map((a) => a.trim()).filter(Boolean).slice(0, LIMITS.areasMax),
          institutionId: d.institutionId || null,
          bedrooms: d.bedrooms,
          sizeTarget: d.sizeTarget,
          budgetMinMinor: koboOf(d.budgetMin),
          budgetMaxMinor: koboOf(d.budgetMax),
          budgetPeriod: d.budgetPeriod,
          moveInOn: d.moveInOn || null,
        });
        if (!result.ok) {
          setProblems(result.fieldErrors ?? {});
          banner.error(result.error);
          return;
        }
        feedback("confirm");
        banner.success(C.created, { "data-testid": "rm-group-created" });
        router.push(ROOMMATES_ROUTES.group(result.data.id));
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });

  const stepper = (value: number, min: number, max: number, onChange: (n: number) => void, label: string) => (
    <div className="nf-rms-stepper" role="group" aria-label={label}>
      <button type="button" className="nf-rmb-chip" aria-label={`${label} -`} disabled={value <= min} onClick={() => onChange(value - 1)}>
        -
      </button>
      <span className="nf-rms-stepper__value" aria-live="polite">
        {value}
      </span>
      <button type="button" className="nf-rmb-chip" aria-label={`${label} +`} disabled={value >= max} onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  );

  if (step === 1) {
    return (
      <StepFrame
        {...common}
        step={1}
        eyebrow={C.stepBasics}
        title={C.title}
        primary={{ label: C.continue, onClick: forward, disabled: d.name.trim().length < LIMITS.groupNameMin, testId: "rm-ng-next" }}
      >
        <div className="grid gap-md">
          <div className="nf-rmb-field">
            <label htmlFor="rm-ng-name">{C.name}</label>
            <input id="rm-ng-name" value={d.name} maxLength={LIMITS.groupNameMax} placeholder={C.namePlaceholder} {...field("name")} onChange={(e) => set({ name: e.target.value })} />
            {problem("name")}
          </div>
          <div className="nf-rmb-field">
            <label htmlFor="rm-ng-intro">{C.intro}</label>
            <textarea autoCapitalize="sentences" enterKeyHint="enter" id="rm-ng-intro" value={d.intro} maxLength={LIMITS.groupIntroMax} placeholder={C.introPlaceholder} onChange={(e) => set({ intro: e.target.value })} />
            <span className="nf-rmb-field__hint nf-numeric">{`${d.intro.length} / ${LIMITS.groupIntroMax}`}</span>
          </div>
        </div>
      </StepFrame>
    );
  }
  if (step === 2) {
    const options = [
      { key: "open" as const, label: C.open, sub: C.openSub },
      { key: "private" as const, label: C.private, sub: C.privateSub },
    ];
    return (
      <StepFrame {...common} step={2} eyebrow={C.stepWho} title={C.stepWho} primary={{ label: C.continue, onClick: forward, testId: "rm-ng-next" }}>
        <div role="radiogroup" aria-label={C.stepWho} className="grid gap-sm">
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              role="radio"
              aria-checked={d.visibility === o.key}
              className="nf-rmb-option"
              onClick={() => {
                feedback("select");
                set({ visibility: o.key });
              }}
            >
              <span>{o.label}</span>
              <span className="nf-rmb-option__sub">{o.sub}</span>
            </button>
          ))}
        </div>
      </StepFrame>
    );
  }
  if (step === 3) {
    return (
      <StepFrame {...common} step={3} eyebrow={C.stepWhere} title={C.stepWhere} primary={{ label: C.continue, onClick: forward, testId: "rm-ng-next" }}>
        <div className="grid gap-md">
          <div className="nf-rmb-grid2">
            <div className="nf-rmb-field">
              <label htmlFor="rm-ng-state">{C.state}</label>
              <select id="rm-ng-state" value={d.stateCode} onChange={(e) => set({ stateCode: e.target.value })}>
                <option value="">{C.any}</option>
                {STATE_OPTIONS.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="nf-rmb-field">
              <label htmlFor="rm-ng-city">{C.city}</label>
              <input id="rm-ng-city" value={d.city} maxLength={60} placeholder={C.cityPlaceholder} {...field("city")} onChange={(e) => set({ city: e.target.value })} />
              {problem("city")}
            </div>
          </div>
          <div className="nf-rmb-field">
            <label htmlFor="rm-ng-areas">{C.areas}</label>
            <input type="text" autoComplete="off" autoCapitalize="words" id="rm-ng-areas" value={d.areas} placeholder={C.areasPlaceholder} onChange={(e) => set({ areas: e.target.value })} />
          </div>
          <div className="nf-rmb-field">
            <label htmlFor="rm-ng-school">{C.school}</label>
            <select id="rm-ng-school" value={d.institutionId} onChange={(e) => set({ institutionId: e.target.value })}>
              <option value="">{C.noSchool}</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </StepFrame>
    );
  }
  if (step === 4) {
    return (
      <StepFrame {...common} step={4} eyebrow={C.stepHome} title={C.stepHome} primary={{ label: C.continue, onClick: forward, testId: "rm-ng-next" }}>
        <div className="grid gap-lg">
          <div className="nf-rmb-field">
            <span className="nf-rmb-field__label">{C.size}</span>
            {stepper(d.sizeTarget, 2, 8, (n) => set({ sizeTarget: n }), C.size)}
          </div>
          <div className="nf-rmb-field">
            <span className="nf-rmb-field__label" id="rm-ng-beds">
              {C.bedrooms}
            </span>
            <div role="radiogroup" aria-labelledby="rm-ng-beds" className="nf-rms-people">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={d.bedrooms === n} className="nf-rmb-chip" onClick={() => set({ bedrooms: d.bedrooms === n ? null : n })}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      </StepFrame>
    );
  }
  if (step === 5) {
    return (
      <StepFrame {...common} step={5} eyebrow={C.stepMoney} title={C.stepMoney} primary={{ label: C.continue, onClick: forward, testId: "rm-ng-next" }} secondary={{ label: C.skip, onClick: forward }}>
        <div className="grid gap-md">
          <div className="nf-rmb-grid2">
            <div className="nf-rmb-field">
              <label htmlFor="rm-ng-min">{C.budgetMin}</label>
              <input id="rm-ng-min" inputMode="numeric" value={d.budgetMin} placeholder="0" onChange={(e) => set({ budgetMin: nairaDisplay(e.target.value) })} />
            </div>
            <div className="nf-rmb-field">
              <label htmlFor="rm-ng-max">{C.budgetMax}</label>
              <input id="rm-ng-max" inputMode="numeric" value={d.budgetMax} placeholder="0" {...field("budgetMaxMinor")} onChange={(e) => set({ budgetMax: nairaDisplay(e.target.value) })} />
              {problem("budgetMaxMinor")}
            </div>
          </div>
          <div className="nf-rmb-field">
            <span className="nf-rmb-field__label" id="rm-ng-per">
              {C.period}
            </span>
            <div role="radiogroup" aria-labelledby="rm-ng-per" className="nf-rmb-actions">
              {(["year", "month"] as const).map((p) => (
                <button key={p} type="button" role="radio" aria-checked={d.budgetPeriod === p} className="nf-rmb-chip" onClick={() => set({ budgetPeriod: p })}>
                  {R.periods[p]}
                </button>
              ))}
            </div>
          </div>
          <div className="nf-rmb-field">
            <label htmlFor="rm-ng-move">{C.moveIn}</label>
            <input id="rm-ng-move" type="date" value={d.moveInOn} {...field("moveInOn")} onChange={(e) => set({ moveInOn: e.target.value })} />
            {problem("moveInOn")}
          </div>
        </div>
      </StepFrame>
    );
  }
  const school = schools.find((s) => s.id === d.institutionId)?.name ?? null;
  const rows: [string, string][] = [
    [C.name, d.name],
    [C.stepWho, d.visibility === "open" ? C.open : C.private],
    [C.city, [d.city, STATE_OPTIONS.find((s) => s.code === d.stateCode)?.name].filter(Boolean).join(", ") || C.any],
    [C.areas, d.areas || C.any],
    [C.school, school ?? C.noSchool],
    [C.size, String(d.sizeTarget)],
    [C.bedrooms, d.bedrooms ? String(d.bedrooms) : C.any],
    [C.budgetMax, d.budgetMax ? `${d.budgetMin ? `${d.budgetMin} - ` : ""}${d.budgetMax}${R.perPeriod[d.budgetPeriod]}` : C.any],
    [C.moveIn, d.moveInOn || C.any],
  ];
  return (
    <StepFrame {...common} step={6} eyebrow={C.stepReview} title={C.stepReview} primary={{ label: C.createIt, onClick: create, loading: pending, testId: "rm-ng-create" }}>
      <dl className="nf-rmb-card grid gap-sm" data-testid="rm-ng-review">
        {rows.map(([k, v]) => (
          <div key={k} className="grid gap-3xs">
            <dt className="nf-rmb-row__line">{k}</dt>
            <dd className="nf-rmb-row__title m-0">{v}</dd>
          </div>
        ))}
        {d.intro ? <p className="nf-rmg-head__intro">{d.intro}</p> : null}
      </dl>
    </StepFrame>
  );
}
