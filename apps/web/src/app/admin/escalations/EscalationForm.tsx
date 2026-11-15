"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { FieldProblem } from "@/components/ui/FieldProblem";
import { raiseEscalation, type RaisedEscalation } from "@/lib/admin/escalations/actions";
import {
  CATEGORY_LABEL,
  ESCALATION_CATEGORIES,
  ESCALATION_SEVERITIES,
  LIMITS,
  NO_TIP_OFF_CATEGORIES,
  PERSONAL_NUMBER_REFUSAL,
  ROUTE_CHOICES,
  SEVERITY_LABEL,
  carriesPersonalNumber,
  planRoute,
  routeName,
  type EscalationCategory,
  type EscalationRoute,
  type EscalationSeverity,
} from "@/lib/admin/escalations/types";
import { sentWords, whereItGoesWords } from "@/lib/admin/escalations/words";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { PROSE_KEYBOARD } from "@/lib/ui/field-keyboard";
import { banner } from "@/lib/ui/toast";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

/**
 * THE ESCALATION FORM, the same one in the shell's sheet and on
 * `/admin/escalations/new`.
 *
 * Five questions, in the order a person thinks them: what kind of issue, how
 * urgent, a short title, what happened, what you need from them. Under them
 * it says in plain words where this will go and how soon they aim to answer,
 * with a way to send it somewhere else. The page it was raised from travels
 * as a link ("Attached: this page"), so nobody has to paste an ID number, a
 * bank detail or a document, and the form refuses a long run of digits
 * before anything is sent: the field is marked, the banner says why
 * (`FieldProblem`, the console's one way of saying a problem) and Send stays
 * off. The server checks every one of these again.
 */
export const FORM_COPY = {
  category: "What kind of issue is it?",
  severity: "How urgent is it?",
  title: "A short title",
  titleHint: "What it is, in a few words. The receiver sees this first.",
  whatHappened: "What happened",
  whatHappenedHint: "What you saw and what you have already done about it.",
  whatIsNeeded: "What you need from them",
  whatIsNeededHint: "The decision or the action you are asking for.",
  noPaste: "Do not paste ID numbers, bank details or documents. The link carries the record.",
  noTipOff: "Never tell the member you suspect them.",
  attached: "Attached:",
  thisPage: "this page",
  nothingAttached: "Nothing is attached. Open the record first if this is about one.",
  elsewhere: "Send it somewhere else",
  backToChoice: "Let the kind of issue decide",
  whereLabel: "Send it to",
  send: "Send escalation",
  sentTitle: "Sent",
  open: "Open it",
  another: "Raise another",
} as const;

export type EscalationFormProps = {
  /** The admin page this was raised from, path and query. */
  sourcePath: string;
  /** The record to attach: a console path, or null when there is none. */
  recordUrl: string | null;
  /** What the attached link is called. Null reads as "this page". */
  recordLabel: string | null;
  initialCategory?: EscalationCategory;
  /** Routes that have somebody on them, from the database; null when unknown. */
  staffed: readonly string[] | null;
  /** Called once it is sent, for the sheet to close. */
  onDone?: (raised: RaisedEscalation) => void;
};

type Problems = Partial<Record<"category" | "severity" | "title" | "whatHappened" | "whatIsNeeded" | "routedTo" | "recordUrl", string>>;

export function EscalationForm({ sourcePath, recordUrl, recordLabel, initialCategory, staffed, onDone }: EscalationFormProps) {
  const router = useRouter();
  const ids = useId();
  const [category, setCategory] = useState<EscalationCategory>(initialCategory ?? "other");
  const [severity, setSeverity] = useState<EscalationSeverity>("normal");
  const [title, setTitle] = useState("");
  const [whatHappened, setWhatHappened] = useState("");
  const [whatIsNeeded, setWhatIsNeeded] = useState("");
  const [chosen, setChosen] = useState<EscalationRoute | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [problems, setProblems] = useState<Problems>({});
  const [sent, setSent] = useState<RaisedEscalation | null>(null);
  const [pending, start] = useSafeTransition();

  const plan = planRoute(category, chosen, staffed);
  const numbers = {
    title: carriesPersonalNumber(title),
    whatHappened: carriesPersonalNumber(whatHappened),
    whatIsNeeded: carriesPersonalNumber(whatIsNeeded),
  };
  const hasNumber = numbers.title || numbers.whatHappened || numbers.whatIsNeeded;
  const ready =
    title.trim().length >= LIMITS.title.min &&
    whatHappened.trim().length >= LIMITS.whatHappened.min &&
    whatIsNeeded.trim().length >= LIMITS.whatIsNeeded.min &&
    !hasNumber;
  const problemOf = (key: keyof typeof numbers) => (numbers[key] ? PERSONAL_NUMBER_REFUSAL : problems[key]);
  const mark = (key: keyof typeof numbers) =>
    problemOf(key) ? { "aria-invalid": true as const, "aria-describedby": `${ids}-${key}-problem` } : {};

  function send() {
    start(async () => {
      try {
        const result = await raiseEscalation({
          category,
          severity,
          title,
          whatHappened,
          whatIsNeeded,
          sourcePath,
          recordUrl,
          recordLabel,
          routedTo: chosen,
        });
        if (!result.ok) {
          setProblems((result.fieldErrors ?? {}) as Problems);
          banner.error(result.error);
          return;
        }
        const raised = result.data;
        banner.success(sentWords(raised.reference, raised.routedTo, raised.intended), {
          action: { label: FORM_COPY.open, run: () => router.push(`/admin/escalations/${raised.id}`) },
        });
        setProblems({});
        setSent(raised);
        router.refresh();
        onDone?.(raised);
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

  if (sent) {
    return (
      <div className="grid gap-sm" data-testid="escalation-sent" role="status">
        <p className="nf-body font-semibold text-content">{FORM_COPY.sentTitle}</p>
        <p className="nf-body min-w-0 break-words">{sentWords(sent.reference, sent.routedTo, sent.intended)}</p>
        <div className="flex flex-wrap gap-xs">
          <Link href={`/admin/escalations/${sent.id}`} className="nf-btn nf-btn--primary nf-btn--sm" data-testid="escalation-sent-open">
            {FORM_COPY.open}
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSent(null);
              setTitle("");
              setWhatHappened("");
              setWhatIsNeeded("");
              setChosen(null);
              setChoosing(false);
            }}
          >
            {FORM_COPY.another}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="grid gap-md"
      data-testid="escalation-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (ready && !pending) send();
      }}
    >
      <label className="grid gap-3xs">
        <span className="nf-label">{FORM_COPY.category}</span>
        <select
          className="nf-field"
          value={category}
          disabled={pending}
          onChange={(e) => setCategory(e.target.value as EscalationCategory)}
          data-testid="escalation-category"
          aria-describedby={`${ids}-category-covers`}
        >
          {ESCALATION_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c].name}
            </option>
          ))}
        </select>
        <span id={`${ids}-category-covers`} className="nf-caption">
          {CATEGORY_LABEL[category].covers}
        </span>
      </label>

      <fieldset className="grid gap-2xs" data-testid="escalation-severity">
        <legend className="nf-label">{FORM_COPY.severity}</legend>
        {ESCALATION_SEVERITIES.map((s) => (
          <label
            key={s}
            className={`flex min-h-11 cursor-pointer items-start gap-xs rounded-md border p-sm ${
              severity === s ? "border-[var(--nf-border-brand)]" : "border-[var(--nf-border-subtle)]"
            }`}
          >
            <input
              type="radio"
              name={`${ids}-severity`}
              value={s}
              checked={severity === s}
              disabled={pending}
              onChange={() => setSeverity(s)}
              className="mt-3xs"
            />
            <span className="min-w-0">
              <span className="block font-semibold">
                {SEVERITY_LABEL[s].name}
                <span className="nf-caption font-normal"> · answered {SEVERITY_LABEL[s].answer}</span>
              </span>
              <span className="nf-caption block">{SEVERITY_LABEL[s].when}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <label className="grid gap-3xs">
        <span className="nf-label">{FORM_COPY.title}</span>
        <input
          type="text"
          className="nf-field"
          autoCapitalize="sentences"
          enterKeyHint="next"
          maxLength={LIMITS.title.max}
          value={title}
          disabled={pending}
          onChange={(e) => setTitle(e.target.value)}
          data-testid="escalation-title"
          {...mark("title")}
        />
        <span className="nf-caption">{FORM_COPY.titleHint}</span>
        <FieldProblem id={`${ids}-title-problem`} message={problemOf("title")} />
      </label>

      <label className="grid gap-3xs">
        <span className="nf-label">{FORM_COPY.whatHappened}</span>
        <textarea
          className="nf-field w-full resize-y"
          rows={4}
          maxLength={LIMITS.whatHappened.max}
          {...PROSE_KEYBOARD}
          value={whatHappened}
          disabled={pending}
          onChange={(e) => setWhatHappened(e.target.value)}
          data-testid="escalation-what-happened"
          {...mark("whatHappened")}
        />
        <span className="nf-caption">{FORM_COPY.whatHappenedHint}</span>
        <FieldProblem id={`${ids}-whatHappened-problem`} message={problemOf("whatHappened")} />
      </label>

      <label className="grid gap-3xs">
        <span className="nf-label">{FORM_COPY.whatIsNeeded}</span>
        <textarea
          className="nf-field w-full resize-y"
          rows={3}
          maxLength={LIMITS.whatIsNeeded.max}
          {...PROSE_KEYBOARD}
          value={whatIsNeeded}
          disabled={pending}
          onChange={(e) => setWhatIsNeeded(e.target.value)}
          data-testid="escalation-what-is-needed"
          {...mark("whatIsNeeded")}
        />
        <span className="nf-caption">{FORM_COPY.whatIsNeededHint}</span>
        <FieldProblem id={`${ids}-whatIsNeeded-problem`} message={problemOf("whatIsNeeded")} />
      </label>

      <div className="grid gap-2xs">
        <p className="nf-caption" data-testid="escalation-no-paste">
          {FORM_COPY.noPaste}
        </p>
        {NO_TIP_OFF_CATEGORIES.includes(category) ? (
          <p className="nf-body-sm font-semibold text-content" data-testid="escalation-no-tip-off">
            {FORM_COPY.noTipOff}
          </p>
        ) : null}
        <p className="nf-caption min-w-0 break-words" data-testid="escalation-attached">
          {recordUrl ? (
            <>
              {FORM_COPY.attached}{" "}
              <Link href={recordUrl} className="font-semibold text-[var(--nf-content-link)] underline underline-offset-2">
                {recordLabel?.trim() || FORM_COPY.thisPage}
              </Link>
            </>
          ) : (
            FORM_COPY.nothingAttached
          )}
        </p>
      </div>

      <div className="nf-panel nf-panel--card grid gap-xs p-sm" data-testid="escalation-route">
        <p className="nf-body min-w-0 break-words font-semibold text-content" role="status" data-testid="escalation-where">
          {whereItGoesWords(plan, severity)}
        </p>
        {severity === "urgent" && plan.route !== "super_admin" ? (
          <p className="nf-caption">Because it is urgent, the super admin is told at once as well.</p>
        ) : null}
        {choosing ? (
          <label className="grid gap-3xs">
            <span className="nf-label">{FORM_COPY.whereLabel}</span>
            <select
              className="nf-field"
              value={chosen ?? ""}
              disabled={pending}
              onChange={(e) => setChosen(e.target.value === "" ? null : (e.target.value as EscalationRoute))}
              data-testid="escalation-route-choice"
            >
              <option value="">{FORM_COPY.backToChoice}</option>
              {ROUTE_CHOICES.map((route) => (
                <option key={route} value={route}>
                  {routeName(route)}
                </option>
              ))}
            </select>
            <FieldProblem id={`${ids}-routedTo-problem`} message={problems.routedTo} />
          </label>
        ) : (
          <div>
            <button type="button" className="nf-admin-panel__link" disabled={pending} onClick={() => setChoosing(true)} data-testid="escalation-elsewhere">
              {FORM_COPY.elsewhere}
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-xs">
        <Button type="submit" variant="primary" size="md" loading={pending} disabled={!ready} data-testid="escalation-send">
          {FORM_COPY.send}
        </Button>
      </div>
    </form>
  );
}
