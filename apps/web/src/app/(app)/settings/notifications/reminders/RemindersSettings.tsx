"use client";

import { useState } from "react";

import { RowLink, RowSwitch, SettingsGroup } from "@/components/app/account/rows";
import type { UiIconName } from "@/design-system/icons/UiIcon";
import { setReminderPreference } from "@/lib/features/notices/actions";
import type { NoticePreferences, NoticeTopic } from "@/lib/features/notices/model";
import type { Dictionary } from "@vallo/i18n/core";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { banner } from "@/lib/ui/toast";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

/**
 * The reminder switches (FEATURE_BACKLOG A5 and A6). Optimistic, reverting on
 * refusal, like every settings toggle. When the SQL is not live every switch
 * is drawn on and disabled under one plain sentence: nothing is sent, so
 * there is nothing to switch off.
 */
const GLYPH: Record<NoticeTopic, UiIconName> = {
  new_in_area: "location",
  new_neighbours: "users",
  move_in_review: "star",
  nudges: "bell",
  nudge_phone: "phone",
  nudge_identity: "id-card",
  nudge_listing_draft: "pencil",
  nudge_profile: "camera",
};

const NEAR: readonly NoticeTopic[] = ["new_in_area", "new_neighbours"];
const NUDGES: readonly NoticeTopic[] = ["nudge_phone", "nudge_identity", "nudge_listing_draft", "nudge_profile"];

export function RemindersSettings({
  initial,
  live,
  copy,
  save = setReminderPreference,
}: {
  initial: NoticePreferences;
  live: boolean;
  copy: Dictionary["reminders"];
  /** The preview harness passes a stand-in; the app always uses the action. */
  save?: typeof setReminderPreference;
}) {
  const [prefs, setPrefs] = useState<NoticePreferences>(initial);
  const [pending, start] = useSafeTransition();

  const toggle = (topic: NoticeTopic, next: boolean) => {
    const previous = prefs;
    setPrefs({ ...prefs, [topic]: next });
    start(async () => {
      try {
        const result = await save({ topic, enabled: next });
        if (result.ok) {
          banner.success(copy.saved);
          return;
        }
        setPrefs(previous);
        banner.error(result.error);
      } catch (error) {
        setPrefs(previous);
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  const row = (topic: NoticeTopic, disabled = false) => (
    <RowSwitch
      key={topic}
      icon={GLYPH[topic]}
      label={copy.rows[topic].label}
      sub={copy.rows[topic].sub}
      value={prefs[topic] && !disabled ? copy.on : copy.off}
      checked={prefs[topic] && !disabled}
      onChange={(next) => toggle(topic, next)}
      disabled={!live || pending || disabled}
      testId={`reminder-${topic}`}
    />
  );

  return (
    <div className="flex flex-col gap-xl" data-testid="reminders-settings">
      {!live && (
        <p className="nf-sgroup__note" data-testid="reminders-off-account">
          {copy.idle}
        </p>
      )}
      <SettingsGroup label={copy.groups.near}>{NEAR.map((t) => row(t))}</SettingsGroup>
      <SettingsGroup label={copy.groups.after}>{row("move_in_review")}</SettingsGroup>
      <SettingsGroup label={copy.groups.nudges} note={copy.nudgesNote}>
        {row("nudges")}
        {NUDGES.map((t) => row(t, !prefs.nudges))}
      </SettingsGroup>
      <SettingsGroup label={copy.groups.elsewhere}>
        <RowLink
          href="/settings/notifications"
          icon="calendar-booking"
          label={copy.elsewhere.label}
          sub={copy.elsewhere.sub}
          testId="reminders-elsewhere"
        />
      </SettingsGroup>
    </div>
  );
}
