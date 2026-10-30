"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TextField, TextArea } from "@/components/ui/Field";
import { createReplyTemplate, deleteReplyTemplate, saveAgentHours } from "@/lib/agent/tools-actions";
import { TEMPLATE_BODY_MAX, TEMPLATE_TITLE_MAX, type ReplyTemplate } from "@/lib/agent/reply-templates";
import { WEEKDAYS, WEEKDAY_SHORT, type Schedule, type Weekday } from "@/lib/agent/hours";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

/** Saved replies: a title to find it by, the words, one tap to put it in a message. */
export function ReplyTemplatesCard({ templates }: { templates: ReplyTemplate[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useSafeTransition();

  function add() {
    setError(null);
    start(async () => {
      const result = await createReplyTemplate({ title, body });
      if (!result.ok) return setError(result.error);
      setTitle("");
      setBody("");
      router.refresh();
    });
  }

  function remove(id: string) {
    setError(null);
    start(async () => {
      const result = await deleteReplyTemplate({ id });
      if (!result.ok) return setError(result.error);
      router.refresh();
    });
  }

  return (
    <section className="nf-panel nf-panel--card block p-panel" data-testid="reply-templates">
      <p className="nf-overline">Saved replies</p>
      <p className="mt-xs nf-body-sm text-[var(--nf-content-secondary)]">
        The answers you give all day. In any conversation they sit above the message box: one tap puts the words in.
      </p>
      {templates.length > 0 ? (
        <ul className="mt-group space-y-xs">
          {templates.map((t) => (
            <li key={t.id} className="flex items-start gap-sm">
              <span className="min-w-0 flex-1">
                <span className="nf-body-sm block font-semibold text-[var(--nf-content-primary)]">{t.title}</span>
                <span className="nf-caption block whitespace-pre-line text-[var(--nf-content-secondary)]">{t.body}</span>
              </span>
              <Button variant="secondary" size="sm" disabled={pending} onClick={() => remove(t.id)}>
                Delete
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-group space-y-sm">
        <TextField label="Title" value={title} maxLength={TEMPLATE_TITLE_MAX} placeholder="Viewing times" onChange={(e) => setTitle(e.target.value)} />
        <TextArea label="The reply" rows={3} value={body} maxLength={TEMPLATE_BODY_MAX} onChange={(e) => setBody(e.target.value)} />
        {error ? (
          <p role="alert" className="nf-caption text-[var(--nf-state-error)]">
            {error}
          </p>
        ) : null}
        <Button variant="primary" size="md" loading={pending} onClick={add}>
          Save reply
        </Button>
      </div>
    </section>
  );
}

/** When people can usually reach you, shown on your listings as "Usually available". */
export function AgentHoursCard({ initial }: { initial: Schedule }) {
  const router = useRouter();
  const [week, setWeek] = useState<Schedule>(initial);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useSafeTransition();

  function setDay(day: Weekday, patch: "off" | "on" | { open?: string; close?: string }) {
    setNote(null);
    setWeek((w) => {
      if (patch === "off") return { ...w, [day]: null };
      const current = w[day] ?? { open: "09:00", close: "18:00" };
      if (patch === "on") return { ...w, [day]: current };
      return { ...w, [day]: { ...current, ...patch } };
    });
  }

  function save() {
    setNote(null);
    start(async () => {
      const result = await saveAgentHours(week as Record<string, unknown>);
      if (!result.ok) return setNote(result.error);
      setNote("Saved.");
      router.refresh();
    });
  }

  return (
    <section className="nf-panel nf-panel--card block p-panel" data-testid="agent-hours">
      <p className="nf-overline">Hours you are usually reachable</p>
      <p className="mt-xs nf-body-sm text-[var(--nf-content-secondary)]">
        Shown on your listings as &quot;Usually available&quot;. It is a habit, not a promise: nothing switches off outside these hours.
      </p>
      <ul className="mt-group space-y-xs">
        {WEEKDAYS.map((day) => {
          const hours = week[day];
          return (
            <li key={day} className="flex flex-wrap items-center gap-sm">
              <label className="flex min-h-11 w-20 items-center gap-xs nf-body-sm">
                <input type="checkbox" checked={Boolean(hours)} onChange={(e) => setDay(day, e.target.checked ? "on" : "off")} />
                {WEEKDAY_SHORT[day]}
              </label>
              {hours ? (
                <>
                  <input
                    type="time"
                    aria-label={`${WEEKDAY_SHORT[day]} opens`}
                    className="nf-input min-h-11"
                    value={hours.open}
                    onChange={(e) => setDay(day, { open: e.target.value })}
                  />
                  <span className="nf-caption">to</span>
                  <input
                    type="time"
                    aria-label={`${WEEKDAY_SHORT[day]} closes`}
                    className="nf-input min-h-11"
                    value={hours.close}
                    onChange={(e) => setDay(day, { close: e.target.value })}
                  />
                </>
              ) : (
                <span className="nf-caption text-[var(--nf-content-muted)]">Off</span>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-group flex items-center gap-sm">
        <Button variant="primary" size="md" loading={pending} onClick={save}>
          Save hours
        </Button>
        {note ? (
          <span role="status" className="nf-caption text-[var(--nf-content-secondary)]">
            {note}
          </span>
        ) : null}
      </div>
    </section>
  );
}
