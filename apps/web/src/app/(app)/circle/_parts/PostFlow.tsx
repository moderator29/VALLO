"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { StepFrame } from "@/components/ui/StepFrame";
import { Button } from "@/components/ui/Button";
import { createCirclePost } from "@/lib/features/circle/actions";
import { CIRCLE_COPY } from "@/lib/features/circle/copy";
import { Icon3D } from "@/components/ui/Icon3D";
import { SuccessBadge } from "@/components/ui/SuccessMoment";
import { feedback } from "@/lib/ui/feedback";
import "./post-flow.css";
import { LIMITS } from "@/lib/features/circle/model";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { banner } from "@/lib/ui/toast";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

const P = CIRCLE_COPY.home.post;

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
  pickType = false,
  initialPosted = null,
}: {
  mode: "question" | "discussion";
  /** Open on the type picker (the compose button): Discussion, Question, Roommate, Property. */
  pickType?: boolean;
  /** The harness only: open on the "Posted!" moment. */
  initialPosted?: { id: string; held: boolean } | null;
  communities: Option[];
  presetCommunityId?: string | null;
  closeHref: string;
  listingId?: string | null;
  prefillTitle?: string | null;
}) {
  const router = useRouter();
  const key = `vallo.circle.draft.${mode}.${presetCommunityId ?? "any"}`;
  const firstStep = pickType ? 0 : presetCommunityId ? 2 : 1;
  const [step, setStep] = useState(firstStep);
  const [kind, setKind] = useState<"question" | "discussion">(mode);
  const [posted, setPosted] = useState<{ id: string; held: boolean } | null>(initialPosted);
  const [dir, setDir] = useState<"forward" | "back">("forward");
  const [draft, setDraft] = useState<Draft>({ communityId: presetCommunityId ?? "", title: prefillTitle ?? "", body: "" });
  const [pending, start] = useSafeTransition();

  useEffect(() => {
    const kept = readDraft(key);
    if (kept && (kept.title || kept.body)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the device draft is read after hydration, so server and first client render agree
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
  const question = kind === "question";

  const publish = () =>
    start(async () => {
      try {
        const result = await createCirclePost({
          communityId: draft.communityId,
          type: kind,
          title: draft.title,
          body: draft.body,
          listingId: listingId ?? null,
        });
        if (!result.ok) {
          banner.error(result.error);
          return;
        }
        writeDraft(key, null);
        feedback("confirm");
        banner.success(result.data.held ? P.postedHeld : P.posted);
        setPosted({ id: result.data.id, held: result.data.held });
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });

  /* THE PAYOFF: "Posted!", with the two ways on. */
  if (posted) {
    return (
      <StepFrame
        step={total}
        total={total}
        eyebrow={P.typeEyebrow}
        title={P.posted}
        subtitle={posted.held ? P.postedHeld : P.postedLine.replace("{community}", community?.name ?? CIRCLE_COPY.title)}
        closeHref="/circle"
        direction="forward"
        primary={{ label: P.view, onClick: () => router.push(`/circle/p/${posted.id}`), testId: "circle-posted-view" }}
      >
        <div className="nf-cposted" data-testid="circle-posted">
          <SuccessBadge />
          <Button variant="quiet" size="md" full onClick={() => router.push("/circle")}>
            {P.back}
          </Button>
        </div>
      </StepFrame>
    );
  }

  /* THE TYPE PICKER: four tiles with the founder's 3D objects. Roommate
     opens the Roommates post flow; Property is a discussion about a home. */
  if (step === 0) {
    const tiles = [
      { key: "discussion", icon: "local-talks", title: P.discussion, sub: P.discussionSub, go: () => { setKind("discussion"); forward(); } },
      { key: "question", icon: "assistant", title: P.question, sub: P.questionSub, go: () => { setKind("question"); forward(); } },
      { key: "roommate", icon: "home-small", title: P.roommate, sub: P.roommateSub, go: () => router.push("/roommates/new") },
      { key: "property", icon: "apartment", title: P.property, sub: P.propertySub, go: () => { setKind("discussion"); forward(); } },
    ] as const;
    return (
      <StepFrame step={1} total={total + 1} eyebrow={P.typeEyebrow} title={P.typeTitle} closeHref={closeHref} direction={dir}>
        <ul className="nf-ctype" data-testid="circle-type-picker">
          {tiles.map((t) => (
            <li key={t.key}>
              <button
                type="button"
                className="nf-ctype__tile"
                data-testid={`circle-type-${t.key}`}
                onClick={() => {
                  feedback("select");
                  t.go();
                }}
              >
                <Icon3D name={t.icon} size={56} />
                <span className="nf-ctype__title">{t.title}</span>
                <span className="nf-ctype__sub">{t.sub}</span>
              </button>
            </li>
          ))}
        </ul>
      </StepFrame>
    );
  }

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
