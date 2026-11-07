"use client";

import { banner } from "@/lib/ui/toast";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { countOf, type Dictionary, type Locale } from "@vallo/i18n/core";
import { useHostPageCopy } from "../host-copy";
import { Button } from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/Field";
import { Switch } from "@/components/ui/Switch";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { Disclosure } from "@/components/app/Disclosure";
import {
  addCalendarImport,
  makeCalendarFeed,
  removeCalendarImport,
  setCalendarImportEnabled,
} from "@/lib/host/calendar-sync-actions";
import { FEED_SOURCES, type FeedSource } from "@/lib/host/ical";
import type { CalendarRoom } from "@/lib/host/rate-calendar";
import type { CalendarImport, SyncState } from "@/lib/host/rate-calendar-queries";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * CALENDAR SYNC FOR ONE ROOM TYPE (C2, 30 September 2026).
 *
 * OUT: the room's own link, for Airbnb or Booking.com to subscribe to. It
 * carries nights booked or closed on Vallo and nothing else.
 * IN: up to five links from other sites. Every pull closes the nights booked
 * there and opens the ones that were dropped; a night booked on Vallo is
 * never touched.
 *
 * Until the lead applies the migration the panel says sync is not on yet and
 * offers nothing to press, rather than buttons that fail.
 */

type CalendarWords = Dictionary["experienceHost"]["calendarUi"];

function ago(iso: string | null, now: number, w: CalendarWords): string {
  if (!iso) return w.notPulled;
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (minutes < 1) return w.justNow;
  if (minutes < 60) return w.minAgo.replace("{n}", String(minutes));
  const hours = Math.round(minutes / 60);
  if (hours < 48) return w.hAgo.replace("{n}", String(hours));
  return w.daysAgo.replace("{n}", String(Math.round(hours / 24)));
}

function siteName(source: string, w: CalendarWords): string {
  return FEED_SOURCES.find((s) => s.value === source)?.label ?? w.anotherSite;
}

export function CalendarSync({
  room,
  sync,
  feedBase,
  locale,
}: {
  room: CalendarRoom;
  sync: SyncState;
  feedBase: string;
  locale: Locale;
}) {
  const router = useRouter();
  const w = useHostPageCopy().calendarUi;
  const [pending, start] = useSafeTransition();
  const [source, setSource] = useState<FeedSource>("airbnb");
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [now] = useState(() => Date.now());

  const feed = sync.feeds.find((f) => f.roomTypeId === room.id) ?? null;
  const imports = sync.imports.filter((i) => i.roomTypeId === room.id);
  const feedUrl = feed ? `${feedBase.replace(/\/$/, "")}/api/calendar/feed?t=${feed.token}` : null;

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string, after?: () => void) =>
    start(async () => {
      try {
        const result = await fn();
        if (!result.ok) {
          /* Said by the one banner at the top of the screen (Grade 1). */
          banner.error(result.error ?? w.failed);
          return;
        }
        banner.success(success);
        after?.();
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });

  const copy = async () => {
    if (!feedUrl) return;
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="nf-rcal-sync" aria-labelledby={`sync-${room.id}`}>
      <div className="nf-rcal-sync__head">
        <span className="nf-rcal-panel__icon" aria-hidden="true">
          <UiIcon name="link" size={20} />
        </span>
        <div className="min-w-0">
          <h3 id={`sync-${room.id}`} className="nf-rcal-panel__title">
            {w.syncTitle}
          </h3>
          <p className="nf-caption">
            {sync.ready
              ? w.syncOn
              : w.syncOff}
          </p>
        </div>
      </div>

      {sync.ready ? (
        <>
          <div className="nf-rcal-sync__block">
            <h4 className="nf-section-label">{w.feedTitle}</h4>
            {feedUrl ? (
              <>
                <div className="nf-rcal-sync__link">
                  <code className="nf-rcal-sync__url">{feedUrl}</code>
                  <Button variant="secondary" size="sm" leadingIcon={copied ? "check" : "link"} onClick={copy}>
                    {copied ? w.copied : w.copy}
                  </Button>
                </div>
                <p className="nf-caption">{w.feedHow}</p>
                <Disclosure label={w.newLink} inline>
                  <p className="nf-caption">{w.newLinkWarn}</p>
                  <Button
                    variant="dangerQuiet"
                    size="sm"
                    disabled={pending}
                    onClick={() => act(() => makeCalendarFeed({ roomTypeId: room.id, fresh: true }), w.newLinkDone)}
                  >
                    {w.replaceLink}
                  </Button>
                </Disclosure>
              </>
            ) : (
              <Button
                variant="secondary"
                size="md"
                leadingIcon="link"
                loading={pending}
                disabled={pending}
                onClick={() => act(() => makeCalendarFeed({ roomTypeId: room.id }), w.linkReady)}
              >
                {w.makeLink}
              </Button>
            )}
          </div>

          <div className="nf-rcal-sync__block">
            <h4 className="nf-section-label">{w.importsTitle}</h4>
            {imports.length > 0 ? (
              <ul className="nf-rcal-sync__imports">
                {imports.map((imp) => (
                  <ImportRow key={imp.id} imp={imp} now={now} pending={pending} act={act} locale={locale} w={w} />
                ))}
              </ul>
            ) : (
              <p className="nf-caption">{w.noneLinked}</p>
            )}
            {imports.length < 5 ? (
              <form
                className="nf-rcal-sync__add"
                onSubmit={(event) => {
                  event.preventDefault();
                  act(
                    () => addCalendarImport({ roomTypeId: room.id, source, url }),
                    w.linked,
                    () => setUrl(""),
                  );
                }}
              >
                <SelectField label={w.from} value={source} onChange={(event) => setSource(event.target.value as FeedSource)}>
                  {FEED_SOURCES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label ?? w.anotherSite}
                    </option>
                  ))}
                </SelectField>
                <TextField
                  label={w.icsLabel}
                  inputMode="url"
                  autoComplete="off"
                  placeholder="https://www.airbnb.com/calendar/ical/..."
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                />
                <Button type="submit" variant="secondary" size="md" disabled={pending || url.trim().length === 0}>
                  {w.linkCalendar}
                </Button>
              </form>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}

function ImportRow({
  imp,
  now,
  pending,
  act,
  locale,
  w,
}: {
  imp: CalendarImport;
  w: CalendarWords;
  now: number;
  pending: boolean;
  locale: Locale;
  act: (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) => void;
}) {
  const failing = imp.failures >= 2;
  return (
    <li className="nf-rcal-sync__import">
      <div className="min-w-0 flex-1">
        <p className="nf-rcal-sync__import-name">
          {w.fromSite.replace("{site}", siteName(imp.source, w))}
          {failing ? (
            <StatusBadge tone="error" kind="dot" className="ml-xs">
              {w.needsLook}
            </StatusBadge>
          ) : !imp.enabled ? (
            <StatusBadge tone="neutral" className="ml-xs">
              {w.paused}
            </StatusBadge>
          ) : null}
        </p>
        <p className="nf-caption">
          {imp.lastError && imp.failures > 0 ? imp.lastError : `${ago(imp.lastSyncedAt, now, w)}, ${countOf(imp.nightsBlocked, "nightsClosed", locale)}`}
        </p>
      </div>
      <Switch
        checked={imp.enabled}
        aria-label={w.syncFrom.replace("{site}", siteName(imp.source, w))}
        disabled={pending}
        onCheckedChange={(next) =>
          act(() => setCalendarImportEnabled({ importId: imp.id, enabled: next }), next ? w.resumed : w.pausedDone)
        }
      />
      <Button
        variant="quiet"
        size="sm"
        iconOnly
        aria-label={w.unlink.replace("{site}", siteName(imp.source, w))}
        disabled={pending}
        onClick={() => act(() => removeCalendarImport({ importId: imp.id }), w.unlinked)}
      >
        <UiIcon name="trash" size={16} />
      </Button>
    </li>
  );
}
