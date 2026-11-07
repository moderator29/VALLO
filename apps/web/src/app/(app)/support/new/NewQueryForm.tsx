"use client";

import { banner } from "@/lib/ui/toast";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { Button, ButtonLink } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/Field";
import { OptionCards } from "@/components/ui/OptionCards";
import { StepFrame } from "@/components/ui/StepFrame";
import { Sheet } from "@/components/ui/Sheet";
import { OfflineNote, useOnline } from "@/components/support/OfflineNote";
import { PhotoField } from "@/components/support/PhotoField";
import { uploadTicketPhoto, type PreparedPhoto } from "@/components/support/photo";
import { fileSupportTicket } from "@/lib/support/actions";
import { TicketFiledSheet } from "@/components/app/account/TicketFiledSheet";
import {
  DESCRIPTION_MAX,
  EMPTY_DRAFT,
  QUERY_KINDS,
  RELATED_KIND_TITLE,
  TOPIC_CHOICES,
  draftErrors,
  parseDraft,
  recordsForTopic,
  topicChoice,
  type DraftErrors,
  type QueryDraft,
  type QueryKind,
  type RelatedRecord,
} from "@/lib/support/new-query";
import { expectedResponse } from "@/lib/support/tickets";
import { IconPlate } from "@/components/ui/IconPlate";
import type { Dictionary } from "@vallo/i18n/core";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

type FormCopy = Dictionary["experienceInbox"]["support"]["form"];

const DRAFT_KEY = "nf_support_new_draft";

export type Filed = { reference: string; id?: string; photoNote?: string };

/**
 * Ask a question or report a problem, filed as a ticket with a reference.
 *
 * One question per screen on the shared step frame (SW5): the kind of
 * message as option cards, the topic as a list with a tick on the chosen
 * row (the linked record in the shared bottom sheet), what happened, then a
 * photo and Send. Everything typed is kept on this device until the ticket is filed, so
 * a reload, a dropped connection or a failed send never costs the member the
 * description; the draft is cleared only once the server has returned a
 * reference.
 *
 * The photo goes up after the ticket exists, because its storage folder is
 * the ticket's id. If that one step fails the ticket is still filed and the
 * success screen says to add the photo from the conversation.
 */
export function NewQueryForm({
  initialKind,
  initialTopic,
  records,
  copy,
}: {
  /** The form's words, `experienceInbox.support.form`, from the server page. */
  copy: FormCopy;
  /** From the link the member tapped; absent keeps the stored draft's kind. */
  initialKind: QueryKind | undefined;
  initialTopic: string | null;
  records: RelatedRecord[];
}) {
  const [draft, setDraft] = useState<QueryDraft>(() => ({
    ...EMPTY_DRAFT,
    kind: initialKind ?? EMPTY_DRAFT.kind,
    topic: topicChoice(initialTopic)?.code ?? null,
  }));
  const [hydrated, setHydrated] = useState(false);
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [sheet, setSheet] = useState<"record" | null>(null);
  const [filed, setFiled] = useState<Filed | null>(null);
  const [pending, start] = useSafeTransition();
  const online = useOnline();
  const bodyRef = useRef<HTMLDivElement | null>(null);

  /* Restore what was typed on this device. The kind and topic the member
     arrived with win over a stored one, because the link they tapped is the
     newer intent. */
  useEffect(() => {
    let stored: QueryDraft | null = null;
    try {
      stored = parseDraft(window.localStorage.getItem(DRAFT_KEY));
    } catch {
      stored = null;
    }
    if (stored) {
      const restored = stored;
      setDraft((current) => ({
        ...restored,
        kind: initialKind ?? restored.kind,
        topic: current.topic ?? restored.topic,
      }));
    }
    setHydrated(true);
  }, [initialKind]);

  useEffect(() => {
    if (!hydrated || filed) return;
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // Storage blocked: the draft lives in memory for this visit.
    }
  }, [draft, hydrated, filed]);

  const offered = useMemo(() => recordsForTopic(draft.topic, records), [draft.topic, records]);

  const update = (next: Partial<QueryDraft>) => {
    setDraft((current) => ({ ...current, ...next }));
    if (next.topic !== undefined && errors.topic) setErrors((e) => ({ ...e, topic: undefined }));
    if (next.body !== undefined && errors.body) setErrors((e) => ({ ...e, body: undefined }));
  };

  /* THE STEPS (SW5, Grade 1): one question per screen. What kind of
     message, what it is about (and the record it concerns), what happened,
     then a photo and Send. Nothing is lost between steps: the draft is the
     same one, kept on this device as before. */
  const [at, setAt] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const go = (next: number) => {
    setDirection(next > at ? "forward" : "back");
    setAt(next);
  };

  /* Continue checks only the question on screen; Send checks them all. */
  const forward = () => {
    const found = draftErrors(draft);
    if (at === 1 && found.topic) {
      setErrors((e) => ({ ...e, topic: found.topic }));
      return;
    }
    if (at === 2 && found.body) {
      setErrors((e) => ({ ...e, body: found.body }));
      bodyRef.current?.querySelector("textarea")?.focus();
      return;
    }
    go(at + 1);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const found = draftErrors(draft);
    setErrors(found);
    if (found.topic) {
      go(1);
      return;
    }
    if (found.body) {
      go(2);
      return;
    }
    if (!online) {
      banner.error(copy.offline, { "data-testid": "support-new-error" });
      return;
    }
    start(async () => {
      try {
        const result = await fileSupportTicket({
          topic: draft.topic ?? "other",
          kind: draft.kind,
          body: draft.body.trim(),
          ...(draft.related ? { related: { kind: draft.related.kind, id: draft.related.id } } : {}),
        });
        if (!result.ok) {
          /* Said by the one banner at the top of the screen (Grade 1). */
          banner.error(result.error, { "data-testid": "support-new-error" });
          return;
        }
        let photoNote: string | undefined;
        if (photo && result.data.id) {
          const uploaded = await uploadTicketPhoto(result.data.id, photo);
          if (!uploaded.ok) photoNote = uploaded.error;
        }
        try {
          window.localStorage.removeItem(DRAFT_KEY);
        } catch {
          // Nothing to clear.
        }
        setFiled({ reference: result.data.reference, id: result.data.id, photoNote });
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  /* `filed` is set only from `fileSupportTicket`'s ok, so the sheet opens
     once, at filing, over the view that keeps the reference. */
  if (filed)
    return (
      <>
        <FiledView filed={filed} topic={draft.topic} copy={copy} />
        <TicketFiledSheet reference={filed.reference} />
      </>
    );

  const problem = draft.kind === "problem";
  const total = 4;
  const last = at === total - 1;
  const titles = [copy.kindLabel, copy.about, problem ? copy.whatHappened : copy.yourQuestion, STEP_WORDS.photoTitle];
  const subtitles = [
    undefined,
    copy.chooseTopicHint,
    problem ? copy.whatHappenedHint : copy.yourQuestionHint,
    STEP_WORDS.photoSub,
  ];

  return (
    <StepFrame
      overlay
      testId="support-new-steps"
      step={at + 1}
      total={total}
      stepLabel={STEP_WORDS.step.replace("{n}", String(at + 1)).replace("{total}", String(total))}
      eyebrow={STEP_WORDS.eyebrows[at]}
      title={titles[at] ?? copy.about}
      subtitle={subtitles[at]}
      direction={direction}
      onBack={at > 0 ? () => go(at - 1) : undefined}
      backLabel={STEP_WORDS.back}
      closeHref="/support"
      closeLabel={copy.close}
      notice={
        errors.topic && at === 1 ? (
          <p id="support-topic-error" role="alert" className="nf-caption text-[var(--nf-state-error)]">
            {errors.topic}
          </p>
        ) : undefined
      }
      primary={
        last
          ? { label: copy.send, type: "submit", form: FORM_ID, loading: pending, disabled: pending, testId: "support-send" }
          : { label: STEP_WORDS.next, onClick: forward, testId: "support-next" }
      }
    >
      <form id={FORM_ID} onSubmit={submit} className="space-y-block" noValidate data-testid="support-new-form">
        {at === 0 ? (
          <OptionCards
            label={copy.kindLabel}
            options={[
              { value: "question", label: copy.question, detail: QUERY_KINDS.question.lede, icon: "chat-bubble" },
              { value: "problem", label: copy.problem, detail: QUERY_KINDS.problem.lede, icon: "alert-triangle" },
            ]}
            value={draft.kind}
            onChange={(kind) => update({ kind: kind as QueryKind })}
            testId="support-kind"
          />
        ) : null}

        {at === 1 ? (
          <div className="space-y-block" data-testid="support-topic">
            <ChoiceList
              label={copy.topics}
              items={TOPIC_CHOICES.map((choice) => ({ key: choice.code, title: copy.topicChoices[choice.code].title, sub: copy.topicChoices[choice.code].hint }))}
              selected={draft.topic}
              onPick={(key) => {
                const next = topicChoice(key);
                const keep = draft.related && next?.records.includes(draft.related.kind) ? draft.related : null;
                update({ topic: next?.code ?? null, related: keep });
              }}
            />
            {offered.length > 0 && (
              <div className="nf-panel nf-panel--card">
                {draft.related ? (
                  <div className="nf-srow" data-testid="support-related-chosen">
                    <span className="nf-srow__body min-w-0">
                      <span className="nf-srow__label break-words">{draft.related.label}</span>
                      <span className="nf-srow__sub">{copy.linkedHint}</span>
                    </span>
                    <Button variant="quiet" size="sm" onClick={() => update({ related: null })} className="shrink-0">
                      {copy.remove}
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="nf-srow w-full cursor-pointer text-left"
                    onClick={() => setSheet("record")}
                    aria-haspopup="dialog"
                    data-testid="support-related"
                  >
                    <span className="nf-srow__body min-w-0">
                      <span className="nf-srow__label">{copy.linkRecord}</span>
                      <span className="nf-srow__sub">{copy.linkRecordHint}</span>
                    </span>
                    <UiIcon name="plus" size={16} className="shrink-0 text-[var(--nf-content-muted)]" />
                  </button>
                )}
              </div>
            )}
          </div>
        ) : null}

        {at === 2 ? (
          <div ref={bodyRef}>
            <TextArea
              label={problem ? copy.whatHappened : copy.yourQuestion}
              hint={problem ? copy.whatHappenedHint : copy.yourQuestionHint}
              value={draft.body}
              onChange={(e) => update({ body: e.target.value })}
              rows={6}
              maxLength={DESCRIPTION_MAX}
              error={errors.body}
              data-testid="support-body"
            />
          </div>
        ) : null}

        {at === 3 ? (
          <>
            <PhotoField value={photo} onChange={setPhoto} disabled={pending} />
            <OfflineNote />
            <p className="nf-caption text-[var(--nf-content-muted)]">
              {copy.afterSend.replace("{expected}", expectedResponse(draft.topic, copy.expected))}
            </p>
          </>
        ) : null}
      </form>

      <Sheet open={sheet === "record"} onOpenChange={(o) => setSheet(o ? "record" : null)} title={copy.linkRecord} closeLabel={copy.close} detents={[0.85]}>
        <RecordList
          records={offered}
          selected={draft.related?.id ?? null}
          onPick={(record) => {
            update({ related: { kind: record.kind, id: record.id, label: record.label } });
            setSheet(null);
          }}
        />
      </Sheet>
    </StepFrame>
  );
}

const FORM_ID = "support-new";

/* The step frame's own words. English until the keys land in the dictionary
   beside `experienceInbox.support.form`. */
const STEP_WORDS = {
  eyebrows: ["Your message", "Topic", "Details", "Photo"],
  photoTitle: "Add a photo",
  photoSub: "Optional. A screenshot or a photo helps the team see it.",
  next: "Continue",
  back: "Back",
  step: "Step {n} of {total}",
} as const;

/** Quiet rows, the chosen one ticked: the sheet list in the founder's first reference. */
function ChoiceList({
  label,
  items,
  selected,
  onPick,
}: {
  label: string;
  items: { key: string; title: string; sub?: string }[];
  selected: string | null;
  onPick(key: string): void;
}) {
  return (
    <ul role="listbox" aria-label={label} className="-mx-xs">
      {items.map((item) => {
        const chosen = item.key === selected;
        return (
          <li key={item.key} role="option" aria-selected={chosen}>
            <button
              type="button"
              onClick={() => onPick(item.key)}
              className="flex min-h-14 w-full cursor-pointer items-center gap-group rounded-[var(--nf-radius-control)] px-xs py-xs text-left hover:bg-[var(--nf-surface-inset)]"
              data-testid={`support-choice-${item.key}`}
            >
              <span className="min-w-0 flex-1">
                <span className="nf-body block font-semibold text-[var(--nf-content-primary)]">{item.title}</span>
                {item.sub && <span className="nf-caption block text-[var(--nf-content-muted)]">{item.sub}</span>}
              </span>
              {chosen && <UiIcon name="check" size={20} className="shrink-0 text-[var(--nf-content-link)]" />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function RecordList({
  records,
  selected,
  onPick,
}: {
  records: RelatedRecord[];
  selected: string | null;
  onPick(record: RelatedRecord): void;
}) {
  const groups = new Map<string, RelatedRecord[]>();
  for (const record of records) groups.set(record.kind, [...(groups.get(record.kind) ?? []), record]);
  return (
    <div className="space-y-group">
      {[...groups.entries()].map(([kind, list]) => (
        <section key={kind} aria-label={RELATED_KIND_TITLE[kind as RelatedRecord["kind"]]}>
          <p className="nf-caption mb-row font-semibold uppercase tracking-[var(--nf-tracking-label)] text-[var(--nf-content-muted)]">
            {RELATED_KIND_TITLE[kind as RelatedRecord["kind"]]}
          </p>
          <ul className="-mx-xs">
            {list.map((record) => {
              const chosen = record.id === selected;
              return (
                <li key={record.id}>
                  <button
                    type="button"
                    onClick={() => onPick(record)}
                    aria-pressed={chosen}
                    className="flex min-h-14 w-full cursor-pointer items-center gap-group rounded-[var(--nf-radius-control)] px-xs py-xs text-left hover:bg-[var(--nf-surface-inset)]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="nf-body-sm block break-words font-semibold text-[var(--nf-content-primary)]">
                        {record.label}
                      </span>
                      {record.sub && (
                        <span className="nf-caption block break-words text-[var(--nf-content-muted)]">{record.sub}</span>
                      )}
                    </span>
                    {chosen && <UiIcon name="check" size={20} className="shrink-0 text-[var(--nf-content-link)]" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** The receipt after filing: the reference, the clock, and the way into the thread. */
export function FiledView({ filed, topic, copy }: { filed: Filed; topic: string | null; copy: FormCopy }) {
  return (
    <div className="nf-panel nf-panel--card block p-card text-center" data-testid="support-filed" role="status">
      <IconPlate size="lg" className="mx-auto">
        <UiIcon name="headset" size={24} />
      </IconPlate>
      <h2 className="nf-h3 mt-group text-[var(--nf-content-primary)]">{copy.filedTitle}</h2>
      <p className="nf-body-sm mx-auto mt-row max-w-[40ch] text-[var(--nf-content-secondary)]">
        {copy.filedBody.replace("{expected}", expectedResponse(topic, copy.expected))}
      </p>
      <div className="mt-group flex justify-center">
        <span
          className="nf-numeric shrink-0 whitespace-nowrap rounded-[var(--nf-radius-control)] border border-[var(--nf-border-subtle)] bg-[var(--nf-surface-inset)] px-sm py-xs text-[length:var(--nf-text-body-lg)] font-bold tracking-wide text-[var(--nf-content-primary)]"
          data-testid="support-filed-reference"
        >
          {filed.reference}
        </span>
      </div>
      {filed.photoNote && <p className="nf-caption mt-group text-[var(--nf-state-warning)]">{filed.photoNote}</p>}
      <div className="mt-block space-y-row">
        {filed.id ? (
          <ButtonLink href={`/support/messages/${filed.id}`} variant="primary" size="lg" full>
            {copy.openConversation}
          </ButtonLink>
        ) : null}
        <Link href="/support" className="nf-link-quiet inline-flex min-h-11 items-center font-semibold">
          {copy.backToHelp}
        </Link>
      </div>
    </div>
  );
}
