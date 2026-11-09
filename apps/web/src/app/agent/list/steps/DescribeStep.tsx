"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextArea, TextField } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import {
  CONDITION_CHOICES,
  FURNISHING_CHOICES,
  MAX_TITLE_LENGTH,
  MIN_DESCRIPTION_WORDS,
  POWER_BACKUP_CHOICES,
  POWER_GRID_CHOICES,
  WATER_SUPPLY_CHOICES,
  asksFact,
  collapseSpaces,
  countWords,
} from "@/lib/agent/listings-model";
import { recordAiConsent } from "@/lib/ai/consent-actions";
import { banner } from "@/lib/ui/toast";
import { feedback } from "@/lib/ui/feedback";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { fill } from "../../_copy";
import { writeListingWithAi, type AiListingInput } from "../describe-actions";
import { Note } from "./parts";
import { WIZARD_WORDS } from "./copy";
import { descriptionFromAnswers, titleFromAnswers } from "./describe";
import type { StepCtx } from "./context";

const W = WIZARD_WORDS.describe;

/**
 * FINISH: "Describe the property" (R18.11, R35, pattern 15). The title with
 * its counter, the description with a word counter that turns green at the
 * minimum, and two ways to a first version:
 *
 *   - "Rewrite from my answers" builds one on the phone from what the lister
 *     already told us (`describe.ts`). Nothing leaves Vallo.
 *   - "Write with AI" asks first, in a sheet that names the provider and
 *     exactly what is sent (and what never is), records the agreement
 *     (`recordAiConsent`, STORE-07), and only then calls the writer, which
 *     refuses without that record whatever this screen did.
 *
 * Either change can be taken back: UNDO puts the lister's own words back
 * exactly, title and description both. AI is a button, not a takeover.
 */
export function DescribeStep({
  ctx,
  titleHint,
  amenityLabels,
  stateName,
  aiConsented,
  preference,
  titleFromAnswersShown,
}: {
  ctx: StepCtx;
  /** STORE-16: a warning, never a refusal, when the title reads as a street address. */
  titleHint: string;
  amenityLabels: string[];
  stateName: string;
  /** Whether this account has already agreed to the AI disclosure. */
  aiConsented: boolean;
  /** SEC-06: a stated tenant preference, as the database will hold it for review. */
  preference: string | null;
  /** The title was started from the answers (the account draft needed one). */
  titleFromAnswersShown: boolean;
}) {
  const { values, set, copy, errors, mark } = ctx;
  const [before, setBefore] = useState<{ title: string; description: string; said: string } | null>(null);
  const [consented, setConsented] = useState(aiConsented);
  const [asking, setAsking] = useState(false);
  const [writing, startWriting] = useSafeTransition();
  const [agreeing, startAgreeing] = useSafeTransition();
  const words = countWords(values.description);
  const titleLength = collapseSpaces(values.title).length;

  function remember(said: string) {
    setBefore({ title: values.title, description: values.description, said });
  }

  function rewrite() {
    const description = descriptionFromAnswers(values, amenityLabels);
    remember(W.rewritten);
    if (values.title.trim() === "") {
      const title = titleFromAnswers(values);
      if (title) set("title", title);
    }
    set("description", description);
    feedback("confirm");
  }

  function aiInput(): AiListingInput {
    const t = values.propertyType;
    return {
      market: ctx.kind,
      propertyType: copy.propertyTypes[t]?.label ?? t,
      area: values.area,
      city: values.city,
      state: stateName,
      bedrooms: asksFact(t, "bedrooms") ? values.bedrooms : null,
      bathrooms: asksFact(t, "bathrooms") ? values.bathrooms : null,
      toilets: values.toilets ? Number(values.toilets) || null : null,
      sizeSqm: values.sizeSqm,
      furnishing: FURNISHING_CHOICES.find((c) => c.value === values.furnished)?.label ?? "",
      condition: CONDITION_CHOICES.find((c) => c.value === values.condition)?.label ?? "",
      power: POWER_GRID_CHOICES.find((c) => c.value === values.powerGrid)?.label ?? "",
      backup: POWER_BACKUP_CHOICES.find((c) => c.value === values.powerBackup)?.label ?? "",
      water: WATER_SUPPLY_CHOICES.find((c) => c.value === values.waterSupply)?.label ?? "",
      amenities: amenityLabels,
      title: values.title,
      description: values.description,
    };
  }

  function write() {
    startWriting(async () => {
      try {
        const result = await writeListingWithAi(aiInput());
        if (!result.ok) {
          banner.error(result.error, { retry: write });
          feedback("error");
          return;
        }
        if (result.data.kind === "consent") {
          setConsented(false);
          setAsking(true);
          return;
        }
        if (result.data.kind === "unavailable") {
          banner.info(W.aiUnavailable);
          return;
        }
        remember(W.aiWritten);
        set("title", result.data.title);
        set("description", result.data.description);
        feedback("confirm");
      } catch {
        banner.error(W.aiFailed, { retry: write });
        feedback("error");
      }
    });
  }

  function agree() {
    startAgreeing(async () => {
      try {
        const recorded = await recordAiConsent();
        if (!recorded.ok) {
          banner.error(recorded.error, { retry: agree });
          return;
        }
        setConsented(true);
        setAsking(false);
        write();
      } catch {
        banner.error(W.aiFailed, { retry: agree });
      }
    });
  }

  return (
    <>
      {titleFromAnswersShown ? <Note glyph="pencil">{W.titleFromAnswers}</Note> : null}
      <div id="listing-title-field">
        <TextField
          label={copy.basics.titleLabel}
          hint={titleHint}
          error={errors.title}
          value={values.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder={copy.basics.titlePlaceholder}
          maxLength={MAX_TITLE_LENGTH}
        />
        <p className="nf-lw2-counter" data-met={titleLength >= 8 ? "" : undefined} data-testid="title-counter">
          {titleLength} / {MAX_TITLE_LENGTH}
        </p>
      </div>
      {mark("title")}

      <div>
        <TextArea
          label={copy.basics.descriptionLabel}
          error={errors.description}
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder={copy.basics.descriptionPlaceholder}
          textAreaClassName="min-h-[11rem]"
          showCount={false}
          maxLength={4000}
        />
        <p
          className="nf-lw2-counter"
          data-met={words >= MIN_DESCRIPTION_WORDS ? "" : undefined}
          aria-live="polite"
          data-testid="description-counter"
        >
          {fill(W.wordCount, { count: words, min: MIN_DESCRIPTION_WORDS })}
        </p>
      </div>
      {mark("description")}

      {preference ? (
        <div data-testid="tenant-preference-warning">
          <Note glyph="info">
            {`This reads as a tenant preference ("${preference}"). Vallo does not allow refusing people for their ethnicity, religion, marital status or gender, so a listing that says this is held for review before it goes up. See `}
            <Link href="/standards" className="underline">
              our standards
            </Link>
            .
          </Note>
        </div>
      ) : null}

      <div className="nf-lw2-writers">
        <Button variant="secondary" full leadingIcon="pencil" onClick={rewrite} disabled={writing} data-testid="describe-rewrite">
          {W.rewrite}
        </Button>
        <Button
          variant="secondary"
          full
          leadingIcon="bot"
          onClick={() => (consented ? write() : setAsking(true))}
          loading={writing}
          data-testid="describe-ai"
        >
          {writing ? W.aiWorking : W.ai}
        </Button>
        <p className="nf-body-sm text-[var(--nf-content-muted)]">{W.rewriteBody}</p>
      </div>

      {before ? (
        <div className="nf-lw2-undo" role="status" data-testid="describe-undo">
          <span>{before.said}</span>
          <Button
            variant="quiet"
            size="sm"
            onClick={() => {
              set("title", before.title);
              set("description", before.description);
              setBefore(null);
              banner.info(W.undone);
            }}
          >
            {W.undo}
          </Button>
        </div>
      ) : null}

      <Sheet
        open={asking}
        onOpenChange={setAsking}
        title={W.consent.title}
        detents={[0.7, 0.92]}
        closeLabel={WIZARD_WORDS.frame.close}
        testId="describe-ai-consent"
        reset={{ label: W.consent.decline, onClick: () => setAsking(false), disabled: agreeing }}
        apply={{ label: W.consent.agree, onClick: agree, loading: agreeing, disabled: agreeing }}
      >
        <p className="nf-body-sm text-[var(--nf-content-secondary)]">{W.consent.body}</p>
        <p className="nf-body-sm mt-sm text-[var(--nf-content-secondary)]">{W.consent.covers}</p>
        <p className="nf-body-sm mt-sm">
          <Link href="/privacy#ai" className="underline">
            {W.consent.how}
          </Link>
        </p>
      </Sheet>
    </>
  );
}
