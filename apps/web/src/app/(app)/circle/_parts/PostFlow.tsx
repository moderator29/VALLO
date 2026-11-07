"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { StepFrame } from "@/components/ui/StepFrame";
import { createCirclePost } from "@/lib/features/circle/actions";
import { LIMITS } from "@/lib/features/circle/model";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { banner } from "@/lib/ui/toast";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

/**
 * ASK THE COMMUNITY, AND START A DISCUSSION (FEED_AND_CIRCLE_BRIEF part 8),
 * one question per screen on StepFrame: where, the title, the details, a
 * preview of the card others will see, publish, the top banner, open it.
 *
 * THE DRAFT SURVIVES AN INTERRUPTION. It is kept on this device under the
 * flow's key (a per-viewer convenience, wrapped in try/catch, the page works
 * without it) and cleared on publish.
 */
type Option = { id: string; name: string };
type Draft = { communityId: string; title: string; body: string };

function readDraft(key: string): Draft | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Draft>;
    return { communityId: String(v.communityId ?? ""), title: String(v.title ?? ""), body: String(v.body ?? "") };
  } catch {
    return null;
  }
}
function writeDraft(key: string, draft: Draft | null) {
  try {
    if (draft) window.localStorage.setItem(key, JSON.stringify(draft));
    else window.localStorage.removeItem(key);
  } catch {
    /* No storage: the flow still works, the draft is just not kept. */
  }
}

export function PostFlow({
  mode,
  communities,
  presetCommunityId,
  closeHref,
  listingId,
  prefillTitle,
}: {
  mode: "question" | "discussion";
  communities: Option[];
  presetCommunityId?: string | null;
  closeHref: string;
  listingId?: string | null;
  prefillTitle?: string | null;
}) {
  const router = useRouter();
  const key = `vallo.circle.draft.${mode}.${presetCommunityId ?? "any"}`;
  const firstStep = presetCommunityId ? 2 : 1;
  const [step, setStep] = useState(firstStep);
  const [dir, setDir] = useState<"forward" | "back">("forward");
  const [draft, setDraft] = useState<Draft>({ communityId: presetCommunityId ?? "", title: prefillTitle ?? "", body: "" });
  const [pending, start] = useSafeTransition();

  useEffect(() => {
    const kept = readDraft(key);
    if (kept && (kept.title || kept.body)) {
      setDraft((d) => ({ ...kept, communityId: presetCommunityId ?? kept.communityId ?? d.communityId }));
    }
  }, [key, presetCommunityId]);

  const update = (patch: Partial<Draft>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    writeDraft(key, next);
  };

  const total = 4;
  const back = step > firstStep ? () => { setDir("back"); setStep(step - 1); } : undefined;
  const forward = () => { setDir("forward"); setStep(step + 1); };
  const community = communities.find((c) => c.id === draft.communityId);
  const question = mode === "question";

  const publish = () =>
    start(async () => {
      try {
        const result = await createCirclePost({
          communityId: draft.communityId,
          type: mode,
          title: draft.title,
          body: draft.body,
          listingId: listingId ?? null,
        });
        if (!result.ok) {
          banner.error(result.error);
          return;
        }
        writeDraft(key, null);
        banner.success(result.data.held ? "Posted. It shows once it has been checked." : question ? "Your question is live" : "Your discussion is live", {
          action: { label: "View", run: () => router.push(`/circle/p/${result.data.id}`) },
        });
        router.push(`/circle/p/${result.data.id}`);
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });

  if (step === 1) {
    return (
      <StepFrame
        step={1}
        total={total}
        eyebrow={question ? "Ask" : "Discuss"}
        title={question ? "Where should we ask?" : "Which community?"}
        subtitle={communities.length ? "Pick the community whose members know the answer." : "Join a community first, then ask there."}
        closeHref={closeHref}
        direction={dir}
        primary={{ label: "Continue", onClick: forward, disabled: !draft.communityId, testId: "circle-flow-next" }}
        secondary={communities.length ? undefined : { label: "Find a community", onClick: () => router.push("/circle") }}
      >
        <div role="radiogroup" aria-label="Community" className="grid gap-sm">
          {communities.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={draft.communityId === c.id}
              className="nf-circle-option"
              onClick={() => update({ communityId: c.id })}
            >
              {c.name}
            </button>
          ))}
        </div>
      </StepFrame>
    );
  }

  if (step === 2) {
    return (
      <StepFrame
        step={2}
        total={total}
        eyebrow={question ? "Your question" : "Your topic"}
        title={question ? "What do you want to know?" : "What do you want to talk about?"}
        subtitle="One clear line. People decide from the title whether they can help."
        onBack={back}
        closeHref={closeHref}
        direction={dir}
        save={draft.title ? "device" : "idle"}
        primary={{ label: "Continue", onClick: forward, disabled: draft.title.trim().length < LIMITS.titleMin, testId: "circle-flow-next" }}
      >
        <div className="nf-circle-field">
          <label htmlFor="circle-title" className="sr-only">Title</label>
          <input
            id="circle-title"
            value={draft.title}
            maxLength={LIMITS.titleMax}
            placeholder={question ? "How much is caution fee in Yaba?" : "Landlords: how do you handle late rent?"}
            onChange={(e) => update({ title: e.target.value })}
          />
          <span className="nf-circle-field__hint">{`${draft.title.length} of ${LIMITS.titleMax}`}</span>
        </div>
      </StepFrame>
    );
  }

  if (step === 3) {
    return (
      <StepFrame
        step={3}
        total={total}
        eyebrow="Details"
        title="Add the details"
        subtitle="The area, the budget, what you have tried. Never a phone number or an address."
        onBack={back}
        closeHref={closeHref}
        direction={dir}
        save={draft.body ? "device" : "idle"}
        primary={{ label: "Preview", onClick: forward, testId: "circle-flow-next" }}
        secondary={{ label: "Skip", onClick: forward }}
      >
        <div className="nf-circle-field">
          <label htmlFor="circle-body" className="sr-only">Details</label>
          <textarea id="circle-body" value={draft.body} maxLength={LIMITS.bodyMax} onChange={(e) => update({ body: e.target.value })} />
        </div>
      </StepFrame>
    );
  }

  return (
    <StepFrame
      step={4}
      total={total}
      eyebrow="Preview"
      title="This is what people will see"
      onBack={back}
      closeHref={closeHref}
      direction={dir}
      primary={{ label: "Publish", onClick: publish, loading: pending, testId: "circle-flow-publish" }}
    >
      <article className="nf-circle-card" data-testid="circle-flow-preview">
        <span className={`nf-circle-card__eyebrow${question ? " nf-circle-card__eyebrow--question" : ""}`}>
          {question ? "Question" : null}
          {community ? <span>{community.name}</span> : null}
        </span>
        <h3 className="nf-circle-card__title">{draft.title}</h3>
        {draft.body ? <p className="nf-circle-card__body">{draft.body}</p> : null}
      </article>
    </StepFrame>
  );
}
