"use client";

import { useId, useState } from "react";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { FieldProblem } from "@/components/ui/FieldProblem";
import { answerWords, initialAnswers, missingAnswer, type CopilotForm, type FormAnswers, type FormField } from "@/lib/chat/question-cards";
import "./question-card.css";

/** A question card and its fate: still open, sent with these answers, or skipped. */
export type QuestionCardState = { form: CopilotForm; status: "open" | "sent" | "skipped"; answers?: FormAnswers };

/**
 * A QUESTION CARD (the founder's ChatGPT reference, 16 November 2026), for
 * the console copilot and the member assistant alike: the questions as choices to tap, and one button whose words say what
 * happens next. Sent, the card locks and shows the answers; skipped, it says
 * so. Each question is a fieldset with its own legend, so a screen reader
 * hears the question before its choices.
 */

const OTHER = "__other__";

function Field({ field, value, onChange, otherText, onOther, disabled }: { field: FormField; value: FormAnswers[string]; onChange: (v: FormAnswers[string]) => void; otherText: string; onOther: (v: string) => void; disabled: boolean }) {
  const name = useId();
  if (field.kind === "single" || field.kind === "multi") {
    const many = field.kind === "multi";
    const chosen = many ? (Array.isArray(value) ? value : []) : typeof value === "string" ? [value] : [];
    const options = [...(field.options ?? []), ...(field.other ? [OTHER] : [])];
    return (
      <div className="nf-cform__opts" role={many ? "group" : "radiogroup"}>
        {options.map((opt) => {
          const on = chosen.includes(opt);
          return (
            <label key={opt} className="nf-cform__opt nf-tap" data-on={on || undefined}>
              {many ? (
                <input type="checkbox" name={name} checked={on} disabled={disabled} onChange={() => onChange(on ? chosen.filter((c) => c !== opt) : [...chosen, opt])} />
              ) : (
                <input type="radio" name={name} checked={on} disabled={disabled} onChange={() => onChange(opt)} />
              )}
              <span className="nf-cform__mark" data-kind={many ? "multi" : "single"} aria-hidden="true">
                {on && many ? <UiIcon name="check" size={14} weight="bold" /> : null}
              </span>
              <span>{opt === OTHER ? "Other" : opt}</span>
            </label>
          );
        })}
        {field.other && chosen.includes(OTHER) ? (
          <input className="nf-field nf-cform__text" autoComplete="off" autoCapitalize="sentences" enterKeyHint="done" value={otherText} onChange={(e) => onOther(e.target.value)} placeholder="Say which" maxLength={60} disabled={disabled} aria-label={`${field.label}, other`} />
        ) : null}
      </div>
    );
  }
  if (field.kind === "yesno" || field.kind === "scale") {
    const steps = field.kind === "yesno" ? (["yes", "no"] as const) : ([1, 2, 3, 4, 5] as const);
    return (
      <div className="nf-cform__seg-wrap">
        <div className="nf-cform__seg" role="radiogroup" data-kind={field.kind}>
          {steps.map((step) => (
            <button key={String(step)} type="button" role="radio" aria-checked={value === step} className="nf-cform__segbtn nf-tap" onClick={() => onChange(step)} disabled={disabled}>
              {step === "yes" ? "Yes" : step === "no" ? "No" : step}
            </button>
          ))}
        </div>
        {field.kind === "scale" && (field.lowLabel || field.highLabel) ? (
          <div className="nf-cform__ends" aria-hidden="true">
            <span>{field.lowLabel}</span>
            <span>{field.highLabel}</span>
          </div>
        ) : null}
      </div>
    );
  }
  if (field.kind === "number") {
    return (
      <input
        className="nf-field nf-cform__text"
        type="number"
        inputMode="decimal"
        enterKeyHint="done"
        autoComplete="off"
        value={typeof value === "number" ? value : ""}
        min={field.min}
        max={field.max}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        disabled={disabled}
      />
    );
  }
  return (
    <input
      className="nf-field nf-cform__text"
      type={field.kind === "date" ? "date" : "text"}
      autoComplete="off"
      autoCapitalize="sentences"
      enterKeyHint="done"
      value={typeof value === "string" ? value : ""}
      placeholder={field.placeholder}
      maxLength={200}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    />
  );
}

export function QuestionCard({ state, onSubmit, onSkip, busy }: { state: QuestionCardState; onSubmit: (answers: FormAnswers) => void; onSkip: () => void; busy: boolean }) {
  const { form, status } = state;
  const [answers, setAnswers] = useState<FormAnswers>(() => initialAnswers(form));
  const [others, setOthers] = useState<Record<string, string>>({});
  const [tried, setTried] = useState(0);
  const uid = useId();
  const locked = status !== "open";

  /* "Other" becomes the person's own words in the answers sent. */
  const resolved: FormAnswers = Object.fromEntries(
    form.fields.map((f) => {
      const v = answers[f.id] ?? null;
      const own = (others[f.id] ?? "").trim();
      if (v === OTHER) return [f.id, own || null];
      if (Array.isArray(v)) return [f.id, v.map((x) => (x === OTHER ? own : x)).filter(Boolean)];
      return [f.id, v];
    }),
  );
  const missing = missingAnswer(form, resolved);

  return (
    <section className="nf-cform" data-status={status} aria-label={form.title ?? "Questions"} data-testid="copilot-form">
      {form.title ? <p className="nf-cform__title">{form.title}</p> : null}
      {form.intro ? <p className="nf-cform__intro">{form.intro}</p> : null}
      {form.fields.map((field, i) => (
        <fieldset key={field.id} className="nf-cform__q" data-first={i === 0 || undefined} disabled={locked}>
          <legend className="nf-cform__label">
            {field.label}
            {field.required === false ? <span className="nf-cform__optional"> (optional)</span> : null}
          </legend>
          {locked && status === "sent" ? (
            <p className="nf-cform__answer">{answerWords(field, state.answers?.[field.id] ?? null)}</p>
          ) : (
            <Field
              field={field}
              value={answers[field.id] ?? null}
              onChange={(v) => setAnswers((a) => ({ ...a, [field.id]: v }))}
              otherText={others[field.id] ?? ""}
              onOther={(v) => setOthers((o) => ({ ...o, [field.id]: v }))}
              disabled={locked}
            />
          )}
          {tried > 0 && missing?.id === field.id && !locked ? <FieldProblem id={`${uid}-${field.id}-need`} message="Answer this one first." when={tried} /> : null}
        </fieldset>
      ))}
      {status === "open" ? (
        <div className="nf-cform__foot">
          <button
            type="button"
            className="nf-cform__submit nf-tap"
            disabled={busy}
            data-testid="copilot-form-submit"
            onClick={() => {
              setTried((n) => n + 1);
              if (!missing) onSubmit(resolved);
            }}
          >
            {form.submit}
          </button>
          <button type="button" className="nf-cform__skip nf-tap" onClick={onSkip} disabled={busy}>
            Skip
          </button>
        </div>
      ) : (
        <p className="nf-cform__done">
          <UiIcon name={status === "sent" ? "circle-check" : "info"} size={16} weight="lean" />
          {status === "sent" ? "Sent" : "Skipped"}
        </p>
      )}
    </section>
  );
}
