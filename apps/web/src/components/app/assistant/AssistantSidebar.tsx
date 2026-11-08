"use client";

import { useMemo, useState } from "react";
import { UiIcon } from "@/design-system/icons/UiIcon";
import type { Thread } from "./threads";
import type { AssistantPrefs } from "@/lib/assistant/prefs";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { AssistantSettingsSheet } from "./AssistantSettingsSheet";
import "@/app/css/home.css";

/**
 * Assistant side navigation.
 *
 * One component serves both placements: the persistent left column on
 * desktop and the slide-in drawer on mobile. Top to bottom it reads search,
 * new chat, conversation history, then a single Settings row pinned to the
 * foot which opens reply style, language and clear-all in a sheet. The search
 * field filters titles and message text so a half-remembered conversation is
 * still findable.
 */


/* On the Lagos clock, like the chat's own timestamps: the server runs on UTC
   and a phone on its own zone, so an unzoned time is written two ways. */
const timeOfDay = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Lagos",
});
const dayOfYear = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "Africa/Lagos",
});
const lagosDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" });

/** Clock time for today's activity, a short date for anything older. */
function whenLabel(timestamp: number): string {
  const then = new Date(timestamp);
  const sameDay = lagosDay.format(then) === lagosDay.format(new Date());
  return sameDay ? timeOfDay.format(then) : dayOfYear.format(then);
}

export function AssistantSidebar({
  threads,
  activeId,
  prefs,
  onSelect,
  onNew,
  onDelete,
  onClearAll,
  onPrefsChange,
}: {
  threads: Thread[];
  activeId: string | null;
  prefs: AssistantPrefs;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  onPrefsChange: (next: AssistantPrefs) => void;
}) {
  const [query, setQuery] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const visible = useMemo(() => {
    const ordered = [...threads].sort((a, b) => b.updatedAt - a.updatedAt);
    const needle = query.trim().toLowerCase();
    if (!needle) return ordered;
    return ordered.filter(
      (t) =>
        t.title.toLowerCase().includes(needle) ||
        t.messages.some((m) => m.text.toLowerCase().includes(needle)),
    );
  }, [threads, query]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* -------------------------------------------- search and new chat */}
      <div className="space-y-xs p-sm pb-sm">
        {/* The sidebar's own search bar was the fifth arrangement of a leading
            icon and a left padding on the platform. It also had no way to get
            back to the whole history except deleting what you typed, which is
            the affordance `clearable` is. */}
        <TextField
          label="Search conversations"
          hideLabel
          type="search"
          leadingIcon="search"
          clearable="Clear the search"
          onClear={() => setQuery("")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search conversations"
          autoComplete="off"
        />
        {/* Secondary: the composer's send is the screen's one primary (T-44). */}
        <Button variant="secondary" size="sm" full onClick={onNew}>
          <UiIcon name="plus" size={16} />
          New chat
        </Button>
      </div>

      {/* ------------------------------------------------------- history */}
      <nav
        aria-label="Conversation history"
        className="min-h-0 flex-1 overflow-y-auto px-sm pb-xs"
      >
        {visible.length === 0 ? (
          <p className="px-2xs pt-sm text-[length:var(--nf-text-caption)] text-[var(--nf-content-muted)]">
            {query.trim()
              ? "No conversations match your search."
              : "Your conversations will appear here."}
          </p>
        ) : (
          <ul className="space-y-2xs">
            {visible.map((t) => {
              const active = t.id === activeId;
              return (
                <li key={t.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => onSelect(t.id)}
                    aria-current={active ? "true" : undefined}
                    /* The active row is the shared selected state (the platform
                       sweep, 23 September; audit S10): the console's nav row
                       on, not a 16 per cent tint of its own. */
                    className={`w-full rounded-control border px-sm py-sm pr-2xl text-left transition-colors ${
                      active
                        ? "nf-ai__row--on"
                        : "border-transparent hover:bg-[image:var(--nf-btn-glass-fill)]"
                    }`}
                  >
                    <span
                      className={`block truncate text-[length:var(--nf-text-caption)] font-semibold ${
                        active
                          ? "text-[var(--nf-content-on-brand)]"
                          : "text-[var(--nf-content-secondary)]"
                      }`}
                      title={t.title}
                    >
                      {t.title}
                    </span>
                    {/* On the chosen row the fill is the brand blue, so the words take the on-brand ink: muted was 2.3:1 on it. */}
                    <span
                      className={`nf-numeric mt-3xs block text-[length:var(--nf-text-overline)] ${
                        active ? "text-[var(--nf-content-on-brand)]" : "text-[var(--nf-content-muted)]"
                      }`}
                    >
                      {whenLabel(t.updatedAt)}
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete conversation: ${t.title}`}
                    onClick={() => onDelete(t.id)}
                    /* Drawn 32px; the transparent `after:` square is its 44px
                       target (W12). Not `nf-tap`: that class sets `position:
                       relative` unlayered, which would beat `absolute` here. */
                    className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 after:absolute after:left-1/2 after:top-1/2 after:size-11 after:-translate-x-1/2 after:-translate-y-1/2 items-center justify-center rounded-sm text-[var(--nf-content-muted)] opacity-70 transition-colors hover:bg-[image:var(--nf-btn-glass-fill)] hover:text-[var(--nf-content-primary)] group-hover:opacity-100"
                  >
                    <UiIcon name="trash" size={16} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      {/* ------------------------------------------------------ settings */}
      {/*
        ONE ROW, AND IT WAS THREE CONTROLS PERMANENTLY OPEN.

        Reply style, language and clear-all were splayed under the history with
        a heading each, taking the bottom third of a column whose job is
        showing you which conversation to go back to. On a phone drawer that
        was most of the history gone - to show settings somebody chooses once
        in their first week and then never looks at again.

        The row sits at the foot the way ChatGPT puts its account there, and
        `AssistantSettingsSheet` holds the lot. The history gets the space.
      */}
      <div className="border-t border-[var(--nf-panel-hair)] p-sm">
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-haspopup="dialog"
          className="nf-tap flex w-full items-center gap-md rounded-control px-sm py-sm text-left text-[var(--nf-content-secondary)] transition-colors hover:bg-[image:var(--nf-btn-glass-fill)] hover:text-[var(--nf-content-primary)]"
        >
          <UiIcon name="settings-gear" size={20} className="shrink-0" />
          <span className="flex-1 text-[length:var(--nf-text-caption)] font-semibold">Settings</span>
          {/* The current reply style, on the row. A settings entry that says
              only "Settings" makes somebody open it to find out what it is
              set to; naming the one they are most likely to be checking
              answers that without a tap. */}
          <span className="shrink-0 text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
            {prefs.length}
          </span>
          <UiIcon name="chevron-right" size={16} className="shrink-0" />
        </button>
      </div>

      <AssistantSettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        prefs={prefs}
        onPrefsChange={onPrefsChange}
        onClearAll={onClearAll}
        threadCount={threads.length}
      />

    </div>
  );
}
