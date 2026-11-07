"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { PhoneGateLink } from "@/components/app/PhoneGateLink";
import { StepFrame } from "@/components/ui/StepFrame";
import { createCommunity } from "@/lib/features/circle/actions";
import { CATEGORY_LABEL, CIRCLE_CATEGORIES, LIMITS, type CircleCategory } from "@/lib/features/circle/model";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { banner } from "@/lib/ui/toast";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

/**
 * CREATE A COMMUNITY (FEED_AND_CIRCLE_BRIEF part 8) on StepFrame: name and
 * description, what it is about, who can see it, rules, preview, create,
 * open. The draft is kept on this device until it is created.
 */
type Draft = { name: string; description: string; category: CircleCategory | ""; visibility: "public" | "private"; rules: string };
const KEY = "vallo.circle.draft.community";
const EMPTY: Draft = { name: "", description: "", category: "", visibility: "public", rules: "" };

export function CreateCommunityFlow() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [dir, setDir] = useState<"forward" | "back">("forward");
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [phoneGate, setPhoneGate] = useState(false);
  const [pending, start] = useSafeTransition();

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) setDraft({ ...EMPTY, ...(JSON.parse(raw) as Partial<Draft>) });
    } catch {
      /* No storage: start clean. */
    }
  }, []);

  const update = (patch: Partial<Draft>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* The draft is just not kept. */
    }
  };
  const total = 5;
  const back = step > 1 ? () => { setDir("back"); setStep(step - 1); } : undefined;
  const forward = () => { setDir("forward"); setStep(step + 1); };
  const rules = draft.rules.split("\n").map((r) => r.trim()).filter(Boolean).slice(0, LIMITS.rulesMax);

  const create = () =>
    start(async () => {
      try {
        const result = await createCommunity({
          name: draft.name,
          description: draft.description,
          category: (draft.category || "general") as CircleCategory,
          visibility: draft.visibility,
          rules,
        });
        if (!result.ok) {
          if (result.gate === "phone") setPhoneGate(true);
          banner.error(result.error);
          return;
        }
        try {
          window.localStorage.removeItem(KEY);
        } catch {
          /* Nothing kept. */
        }
        banner.success("Your community is open");
        router.push(`/circle/c/${result.data.slug}`);
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });

  const common = { total, onBack: back, closeHref: "/circle", direction: dir } as const;

  if (step === 1) {
    return (
      <StepFrame {...common} step={1} eyebrow="The basics" title="Name your community" subtitle="Short and clear: what it is and where." save={draft.name ? "device" : "idle"}
        primary={{ label: "Continue", onClick: forward, disabled: draft.name.trim().length < LIMITS.nameMin, testId: "circle-flow-next" }}>
        <div className="grid gap-md">
          <div className="nf-circle-field">
            <label htmlFor="cc-name">Name</label>
            <input id="cc-name" value={draft.name} maxLength={LIMITS.nameMax} placeholder="Landlords in Lekki" onChange={(e) => update({ name: e.target.value })} />
          </div>
          <div className="nf-circle-field">
            <label htmlFor="cc-desc">What is it for?</label>
            <textarea id="cc-desc" value={draft.description} maxLength={LIMITS.descriptionMax} onChange={(e) => update({ description: e.target.value })} />
            <span className="nf-circle-field__hint">{`${draft.description.length} of ${LIMITS.descriptionMax}`}</span>
          </div>
        </div>
      </StepFrame>
    );
  }
  if (step === 2) {
    return (
      <StepFrame {...common} step={2} eyebrow="Topic" title="What is it about?" primary={{ label: "Continue", onClick: forward, disabled: !draft.category, testId: "circle-flow-next" }}>
        <div role="radiogroup" aria-label="Topic" className="grid gap-sm">
          {CIRCLE_CATEGORIES.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={draft.category === c} className="nf-circle-option" onClick={() => update({ category: c })}>
              {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
      </StepFrame>
    );
  }
  if (step === 3) {
    const options = [
      { key: "public" as const, label: "Public", sub: "Anyone on Vallo can read it. Members post." },
      { key: "private" as const, label: "Private", sub: "People ask to join. Only members read the posts." },
    ];
    return (
      <StepFrame {...common} step={3} eyebrow="Who can see it" title="Public or private?" primary={{ label: "Continue", onClick: forward, testId: "circle-flow-next" }}>
        <div role="radiogroup" aria-label="Who can see it" className="grid gap-sm">
          {options.map((o) => (
            <button key={o.key} type="button" role="radio" aria-checked={draft.visibility === o.key} className="nf-circle-option" onClick={() => update({ visibility: o.key })}>
              <span>{o.label}</span>
              <span className="nf-circle-option__sub">{o.sub}</span>
            </button>
          ))}
        </div>
      </StepFrame>
    );
  }
  if (step === 4) {
    return (
      <StepFrame {...common} step={4} eyebrow="Rules" title="The house rules" subtitle="One per line, up to ten. Members accept them when they join."
        primary={{ label: "Preview", onClick: forward, testId: "circle-flow-next" }} secondary={{ label: "Skip", onClick: forward }}>
        <div className="nf-circle-field">
          <label htmlFor="cc-rules" className="sr-only">Rules</label>
          <textarea id="cc-rules" value={draft.rules} placeholder={"Be kind.\nNo adverts.\nNever share a phone number in a post."} onChange={(e) => update({ rules: e.target.value })} />
        </div>
      </StepFrame>
    );
  }
  return (
    <StepFrame {...common} step={5} eyebrow="Preview" title="Ready to open?" primary={{ label: "Create community", onClick: create, loading: pending, testId: "circle-flow-publish" }}
      notice={phoneGate ? <PhoneGateLink show /> : undefined}>
      <article className="nf-circle-card" data-testid="circle-flow-preview">
        <span className="nf-circle-card__eyebrow">
          <span>{draft.category ? CATEGORY_LABEL[draft.category] : CATEGORY_LABEL.general}</span>
          {draft.visibility === "private" ? <span>Private</span> : null}
        </span>
        <h3 className="nf-circle-card__title">{draft.name}</h3>
        {draft.description ? <p className="nf-circle-card__body">{draft.description}</p> : null}
        {rules.length ? (
          <ol className="nf-circle-rules">
            {rules.map((r) => <li key={r}>{r}</li>)}
          </ol>
        ) : null}
      </article>
    </StepFrame>
  );
}
