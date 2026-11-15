"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { FieldProblem } from "@/components/ui/FieldProblem";
import { actOnEscalation } from "@/lib/admin/escalations/actions";
import {
  LIMITS,
  PERSONAL_NUMBER_REFUSAL,
  ROUTE_CHOICES,
  carriesPersonalNumber,
  routeName,
  type EscalationAction,
} from "@/lib/admin/escalations/types";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { PROSE_KEYBOARD } from "@/lib/ui/field-keyboard";
import { banner } from "@/lib/ui/toast";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

/**
 * WHAT THE VIEWER MAY DO ON ONE ESCALATION. Only the actions the page was
 * told this person may take are drawn (`mayAct`); the server and the database
 * each decide again. Two are one press ("I have seen this", "Take it"). The
 * rest need words first: the choice opens one box that says what to write and
 * who will read it, and a second press sends it.
 */
type Writes = Exclude<EscalationAction, "acknowledge" | "assign"> | "give";

const QUICK: Record<"acknowledge" | "assign", { label: string; done: string }> = {
  acknowledge: { label: "I have seen this", done: "Marked as seen. The raiser has been told." },
  assign: { label: "Take it", done: "It is yours now." },
};

const WRITE: Record<Writes, { choose: string; label: string; hint: string; send: string; done: string; min: number; max: number; danger?: boolean }> = {
  comment: { choose: "Add a note", label: "Your note", hint: "The other side is told there is a note.", send: "Add the note", done: "Note added.", ...LIMITS.note },
  ask_raiser: {
    choose: "Ask the raiser a question",
    label: "Your question",
    hint: "The raiser is told and the clock waits for their answer.",
    send: "Send the question",
    done: "Question sent. The raiser has been told.",
    ...LIMITS.question,
  },
  raiser_reply: { choose: "Answer the question", label: "Your answer", hint: "The people working this are told.", send: "Send the answer", done: "Answer sent.", ...LIMITS.note },
  reroute: {
    choose: "Send to another team",
    label: "Why it should go there",
    hint: "At least 10 characters. The new team reads this first.",
    send: "Send it on",
    done: "Sent on. The new team has been told.",
    ...LIMITS.reason,
  },
  give: { choose: "Give it to somebody", label: "", hint: "They are told it is theirs.", send: "Give it to them", done: "Handed over. They have been told.", min: 0, max: 0 },
  resolve: {
    choose: "Resolve",
    label: "Closing note",
    hint: "At least 10 characters: what was decided or done. The raiser reads it.",
    send: "Resolve it",
    done: "Resolved. The raiser has been told.",
    ...LIMITS.closing,
  },
  decline: {
    choose: "Decline",
    label: "Why you are declining",
    hint: "At least 10 characters. The raiser reads it and can reopen within 14 days.",
    send: "Decline it",
    done: "Declined. The raiser has been told.",
    ...LIMITS.closing,
    danger: true,
  },
  reopen: { choose: "Reopen", label: "Why it should be reopened", hint: "The people it was with are told.", send: "Reopen it", done: "Reopened.", ...LIMITS.reopen },
};

const ORDER: readonly Writes[] = ["raiser_reply", "comment", "ask_raiser", "reroute", "give", "resolve", "decline", "reopen"];

export function EscalationActions({
  id,
  actions,
  people,
  currentRoute,
}: {
  id: string;
  actions: readonly EscalationAction[];
  /** Who a lead may give it to. Empty for everybody else. */
  people: readonly { id: string; name: string }[];
  currentRoute: string;
}) {
  const router = useRouter();
  const ids = useId();
  const [chosen, setChosen] = useState<Writes | null>(null);
  const [body, setBody] = useState("");
  const [target, setTarget] = useState("");
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const [pending, start] = useSafeTransition();

  const offered = ORDER.filter((key) => (key === "give" ? people.length > 0 : actions.includes(key)));
  const quick = (["acknowledge", "assign"] as const).filter((key) => actions.includes(key));
  const routes = ROUTE_CHOICES.filter((route) => route !== currentRoute);
  const spec = chosen ? WRITE[chosen] : null;
  const hasNumber = carriesPersonalNumber(body);
  const ready =
    spec !== null &&
    !hasNumber &&
    (chosen === "give" ? target !== "" : body.trim().length >= spec.min) &&
    (chosen !== "reroute" || target !== "");

  function run(action: EscalationAction, done: string, payload: { body?: string; target?: string } = {}) {
    start(async () => {
      try {
        const result = await actOnEscalation({ id, action, body: payload.body ?? null, target: payload.target ?? null });
        if (!result.ok) {
          setProblem(result.fieldErrors?.["body"] ?? result.fieldErrors?.["target"]);
          banner.error(result.error);
          return;
        }
        banner.success(done);
        setChosen(null);
        setBody("");
        setTarget("");
        setProblem(undefined);
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

  function choose(key: Writes) {
    setChosen(key);
    setBody("");
    setTarget("");
    setProblem(undefined);
  }

  function send() {
    if (!chosen || !spec) return;
    if (chosen === "give") run("assign", spec.done, { target });
    else if (chosen === "reroute") run("reroute", spec.done, { body, target });
    else run(chosen, spec.done, { body });
  }

  return (
    <div className="grid gap-sm" data-testid="escalation-actions">
      {chosen === null || spec === null ? (
        <div className="flex flex-wrap gap-xs">
          {quick.map((key) => (
            <Button key={key} variant="primary" size="sm" disabled={pending} onClick={() => run(key, QUICK[key].done)} data-testid={`escalation-act-${key}`}>
              {QUICK[key].label}
            </Button>
          ))}
          {offered.map((key) => (
            <Button
              key={key}
              variant={key === "raiser_reply" && quick.length === 0 ? "primary" : "secondary"}
              size="sm"
              disabled={pending}
              onClick={() => choose(key)}
              data-testid={`escalation-act-${key}`}
            >
              {WRITE[key].choose}
            </Button>
          ))}
        </div>
      ) : (
        <form
          className="grid gap-xs"
          data-testid="escalation-act-form"
          data-action={chosen}
          onSubmit={(event) => {
            event.preventDefault();
            if (ready && !pending) send();
          }}
        >
          <p className="nf-body font-semibold text-content">{spec.choose}</p>
          {chosen === "reroute" ? (
            <label className="grid gap-3xs">
              <span className="nf-label">Which team</span>
              <select className="nf-field" value={target} disabled={pending} onChange={(e) => setTarget(e.target.value)} data-testid="escalation-act-route">
                <option value="">Choose a team</option>
                {routes.map((route) => (
                  <option key={route} value={route}>
                    {routeName(route)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {chosen === "give" ? (
            <label className="grid gap-3xs">
              <span className="nf-label">Who should have it</span>
              <select className="nf-field" value={target} disabled={pending} onChange={(e) => setTarget(e.target.value)} data-testid="escalation-act-person">
                <option value="">Choose a person</option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="grid gap-3xs">
              <span className="nf-label">{spec.label}</span>
              <textarea
                className="nf-field w-full resize-y"
                rows={3}
                maxLength={spec.max}
                {...PROSE_KEYBOARD}
                value={body}
                disabled={pending}
                onChange={(e) => setBody(e.target.value)}
                data-testid="escalation-act-body"
                {...(problem || hasNumber ? { "aria-invalid": true as const, "aria-describedby": `${ids}-problem` } : {})}
              />
              <FieldProblem id={`${ids}-problem`} message={hasNumber ? PERSONAL_NUMBER_REFUSAL : problem} />
            </label>
          )}
          <p className="nf-caption">{spec.hint}</p>
          <div className="flex flex-wrap gap-xs">
            <Button type="submit" variant={spec.danger ? "danger" : "primary"} size="sm" loading={pending} disabled={!ready} data-testid="escalation-act-send">
              {spec.send}
            </Button>
            <Button variant="ghost" size="sm" disabled={pending} onClick={() => setChosen(null)}>
              Go back
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
