"use client";

import type { ReactNode } from "react";
import { useRef, useState } from "react";
import type { Locale } from "@vallo/i18n/core";
import type { RoleLineCopy } from "@/lib/profile/role-line";
import { RowSwitch, SettingsGroup } from "@/components/app/account/rows";
import { savePassportSettings } from "@/lib/passport/passport-actions";
import {
  PASSPORT_LINES,
  recordedLines,
  withHidden,
  type PassportFacts,
  type PassportLineKey,
  type PassportSettings as Settings,
} from "@/lib/passport/model";
import { buildPassportView, type PassportCopy } from "@/lib/passport/view";
import { PassportBook } from "./PassportBook";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { banner } from "@/lib/ui/toast";

const LINE_ICON = {
  photo: "user",
  role: "id-card",
  joined: "calendar-booking",
  verification: "user-check",
  rentals: "key",
  stays: "house",
  reviews: "star",
  response: "history",
  languages: "chat-bubble",
} as const;

/**
 * THE OWNER'S PASSPORT PAGE: the document as members see it, then the switches.
 *
 * `facts` is the owner's own, every line. The preview applies the switches to
 * it with `withHidden`, the same rule the database applies before a row leaves
 * it, so what the owner sees here is what a member is sent. A change moves the
 * switch and the preview at once and is saved as one write of the whole state;
 * a refusal puts both back and says why.
 */
/* What a change did, said by the one banner (founder, 7 November 2026). */
const WORDS = { saved: "Your passport is updated" };

export function PassportSettings({
  facts,
  initial,
  copy,
  roleCopy,
  locale,
  afterBook = null,
}: {
  /**
   * Drawn between the book and its switches: the member's own trust checks
   * (what others see, and what they can still add). A server-rendered node,
   * handed in so this client component does not have to read anything.
   */
  afterBook?: ReactNode;
  facts: PassportFacts;
  initial: Settings;
  copy: PassportCopy;
  roleCopy: RoleLineCopy;
  locale: Locale;
}) {
  const [settings, setSettings] = useState<Settings>(initial);
  const [pending, startTransition] = useSafeTransition();
  const confirmed = useRef<Settings>(initial);
  const recorded = new Set(recordedLines(facts));

  function commit(next: Settings) {
    setSettings(next);
    startTransition(async () => {
      try {
        const result = await savePassportSettings(next);
        /* Saved or refused, said by the one banner at the top of the screen
           (founder, 7 November 2026); a refusal puts the switch back. */
        if (result.ok) {
          confirmed.current = { enabled: result.data.enabled, hidden: result.data.hidden };
          banner.success(WORDS.saved);
        } else {
          setSettings(confirmed.current);
          banner.error(result.error, { retry: () => commit(next) });
        }
      } catch {
        setSettings(confirmed.current);
        banner.error(copy.saveFailed, { retry: () => commit(next) });
      }
    });
  }

  function setLine(line: PassportLineKey, shown: boolean) {
    const hidden = shown ? settings.hidden.filter((h) => h !== line) : [...settings.hidden, line];
    commit({ enabled: settings.enabled, hidden: PASSPORT_LINES.filter((l) => hidden.includes(l)) });
  }

  const view = buildPassportView(withHidden(facts, settings.hidden), copy, roleCopy, locale);

  return (
    <div className="nf-vps" data-testid="passport-settings">
      <section aria-label={copy.previewLabel}>
        <p className="nf-vps__preview-label">{copy.previewLabel}</p>
        <PassportBook view={view} copy={copy} off={!settings.enabled} testId="passport-preview" />
        {!settings.enabled ? (
          <p className="nf-vps__off-note" role="status" data-testid="passport-off-note">
            {copy.previewOff}
          </p>
        ) : null}
      </section>

      {afterBook}

      <SettingsGroup>
        <RowSwitch
          icon="id-card"
          label={copy.wholeLabel}
          sub={settings.enabled ? copy.wholeOnSub : copy.wholeOffSub}
          value={settings.enabled ? copy.on : copy.off}
          checked={settings.enabled}
          onChange={(next) => commit({ enabled: next, hidden: settings.hidden })}
          disabled={pending}
          testId="passport-switch-all"
        />
      </SettingsGroup>

      <SettingsGroup label={copy.linesLabel} note={copy.linesNote}>
        {PASSPORT_LINES.map((line) => {
          const shown = !settings.hidden.includes(line);
          return (
            <RowSwitch
              key={line}
              icon={LINE_ICON[line]}
              label={copy.line[line]}
              sub={!shown ? copy.hiddenSub : recorded.has(line) ? undefined : copy.notRecorded}
              value={shown ? copy.on : copy.off}
              checked={shown}
              onChange={(next) => setLine(line, next)}
              disabled={pending}
              testId={`passport-switch-${line}`}
            />
          );
        })}
      </SettingsGroup>
    </div>
  );
}
