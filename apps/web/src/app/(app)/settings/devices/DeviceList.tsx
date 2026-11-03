"use client";

import { Button } from "@/components/ui/Button";
import { clearListingDrafts } from "@/lib/agent/listing-draft-storage";
import { useState, useTransition } from "react";
import { plural, type Locale, type PluralForms } from "@vallo/i18n/core";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { Disclosure } from "@/components/app/Disclosure";
import { endOtherSessions, endSession } from "@/lib/security/sessions-actions";
import { endSessionGroup } from "@/lib/security/device-alert-actions";
import { NotMePanel, type NotMeCopy } from "./NotMePanel";
import { signOutEverywhere } from "@/lib/profile/actions";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * The list, and the buttons that end things.
 *
 * A client component for one reason: every action here is destructive and
 * none may fire on a single tap. Everything else, including every string on
 * the screen, is decided by the server component above, so this holds no copy
 * of the session data. The actions call `revalidatePath` and the page
 * re-renders from the database, which is what keeps the screen from ever
 * claiming a device is still signed in after it was thrown off.
 *
 * ## One line per device type (V-19)
 *
 * The page folds the sessions (`lib/security/session-groups.ts`): the one in
 * your hand on its own at the top, then one line per device type, most
 * recently used first, each saying how many sessions it holds. A line can be
 * ended as a whole, and its individual sessions sit behind a `Disclosure` so
 * a person who wants to end exactly one still can. Below the list sits the
 * "This was not me" panel, which does more than sign things out: it holds
 * money leaving the account for 24 hours.
 *
 * ## Confirm-then-act, and why it is one piece of state
 *
 * `armed` holds the key of the one control that is currently one tap from
 * firing: a session id, a group key, or the word "others". A single piece of
 * state rather than a flag per row means arming a second control disarms the
 * first by construction, so a person who changes their mind and taps a
 * different line cannot end the wrong thing with the tap meant to select it.
 */

export type DeviceRow = {
  id: string;
  isCurrent: boolean;
  /** Already assembled from a fixed list of names. Never a raw User-Agent. */
  device: string;
  /** Only present when the device genuinely was not recorded. */
  deviceNote?: string;
  thisDevice: string;
  signedIn: string;
  lastSeen: string;
};

export type DeviceGroupRow = {
  key: string;
  device: string;
  deviceNote?: string;
  /** "89 sessions", already counted in the reader's language. */
  count: string;
  firstSignedIn: string;
  lastUsed: string;
  endLabel: string;
  showLabel: string;
  sessionIds: string[];
  sessions: DeviceRow[];
};

export type DeviceListCopy = {
  intro: string;
  caveat: string;
  endThis: string;
  endCurrent: string;
  endOthers: string;
  endOthersSub: string;
  endOthersNone: string;
  endEverywhere: string;
  endEverywhereSub: string;
  confirm: string;
  working: string;
  endedOne: string;
  endedOthers: string;
  endedNone: string;
  unreadable: string;
  currentTitle: string;
  othersTitle: string;
  othersEmpty: string;
  strangerHint: string;
  groupFailed: string;
  endedGroup: PluralForms;
  notMeTitle: string;
  notMeBody: string;
  notMe: string;
  notMeConfirm: string;
  notMeWorking: string;
};

type Outcome = { tone: "done" | "problem"; message: string } | null;

export function DeviceList({
  current,
  groups,
  othersCount,
  readable,
  copy,
  notMeCopy,
  locale,
}: {
  current: DeviceRow | null;
  groups: DeviceGroupRow[];
  othersCount: number;
  /** False when the read itself failed. Not the same as an empty list. */
  readable: boolean;
  copy: DeviceListCopy;
  notMeCopy: NotMeCopy;
  locale: Locale;
}) {
  const [armed, setArmed] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [pending, startTransition] = useTransition();

  const run = (key: string, work: () => Promise<Outcome>) => {
    if (armed !== key) {
      setArmed(key);
      setOutcome(null);
      return;
    }
    setArmed(null);
    startTransition(async () => {
      try {
        setOutcome(await work());
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  const endOne = (row: DeviceRow) =>
    run(row.id, async () => {
      const result = await endSession({ sessionId: row.id });
      if (!result.ok) return { tone: "problem", message: result.error };
      /*
       * Ending the session you are reading from is allowed, because sometimes
       * it is the right thing: a shared machine, a browser you want off the
       * account. The page is reloaded rather than routed, so the middleware
       * runs against cookies whose refresh token no longer resolves and sends
       * this browser to sign in.
       */
      if (result.data.wasCurrent) {
        window.location.assign("/sign-in?notice=sign-in-required");
        return null;
      }
      return { tone: "done", message: copy.endedOne };
    });

  const endGroup = (group: DeviceGroupRow) =>
    run(`group:${group.key}`, async () => {
      const result = await endSessionGroup({ sessionIds: group.sessionIds.slice(0, 200) });
      if (!result.ok) return { tone: "problem", message: copy.groupFailed };
      return {
        tone: "done",
        message:
          result.data.ended === 0 ? copy.endedNone : plural(result.data.ended, copy.endedGroup, locale),
      };
    });

  const endRest = () =>
    run("others", async () => {
      const result = await endOtherSessions();
      if (!result.ok) return { tone: "problem", message: result.error };
      /* Zero is reported as zero. "Signed out everywhere else" over a list that
         had nothing else on it is the screen claiming work it did not do. */
      return {
        tone: "done",
        message: result.data.ended === 0 ? copy.endedNone : copy.endedOthers,
      };
    });

  /* SEC-08: the explicit "every device, this one too". Signing out from
     settings ends only this device; this is where ending all of them lives. */
  const endEverywhere = () =>
    run("everywhere", async () => {
      const result = await signOutEverywhere();
      if (!result.ok) return { tone: "problem", message: result.error };
      /* SUP-16: a listing draft never outlives the session that wrote it. */
      clearListingDrafts();
      /* A full load, for the same reason as ending the current session above:
         the proxy must see cookies that no longer resolve. */
      window.location.assign("/sign-in?notice=sign-in-required");
      return null;
    });

  return (
    <div className="space-y-block">
      <p className="nf-body-sm text-content-2">{copy.intro}</p>

      {!readable && (
        <p role="alert" className="nf-panel nf-panel--card block p-card nf-body-sm text-content">
          {copy.unreadable}
        </p>
      )}

      {outcome && (
        <p
          role="status"
          data-testid="devices-outcome"
          className={`nf-panel nf-panel--card block p-card nf-body-sm ${
            outcome.tone === "problem" ? "text-danger" : "text-content"
          }`}
        >
          {outcome.message}
        </p>
      )}

      {current && (
        <section aria-labelledby="devices-current-title">
          <h2 id="devices-current-title" className="nf-caption mb-row text-muted">
            {copy.currentTitle}
          </h2>
          <div className="nf-panel nf-panel--card block p-card" data-testid="device-row">
            <div className="flex items-start justify-between gap-inline">
              <div className="min-w-0">
                <p className="nf-body font-semibold text-content">{current.device}</p>
                {current.deviceNote && (
                  <p className="nf-caption mt-row text-muted">{current.deviceNote}</p>
                )}
              </div>
              <span className="nf-caption shrink-0 text-brand" data-testid="device-current">
                {current.thisDevice}
              </span>
            </div>
            <Facts first={current.signedIn} last={current.lastSeen} />
            <Button
              variant={armed === current.id ? "danger" : "secondary"}
              size="sm"
              full
              onClick={() => endOne(current)}
              disabled={pending}
              data-testid="device-end"
              className="mt-group"
            >
              {armed === current.id ? copy.confirm : copy.endCurrent}
            </Button>
          </div>
        </section>
      )}

      {readable && (
        <section aria-labelledby="devices-others-title" data-testid="device-groups">
          <h2 id="devices-others-title" className="nf-caption mb-row text-muted">
            {copy.othersTitle}
          </h2>
          {groups.length === 0 ? (
            <p
              className="nf-panel nf-panel--card block p-card nf-body-sm text-content-2"
              data-testid="device-groups-empty"
            >
              {copy.othersEmpty}
            </p>
          ) : (
            <>
              <p className="nf-caption mb-row text-muted">{copy.strangerHint}</p>
              <ul className="space-y-row">
                {groups.map((group) => {
                  const key = `group:${group.key}`;
                  return (
                    <li key={group.key} className="nf-panel nf-panel--card block p-card" data-testid="device-group">
                      <div className="flex items-start justify-between gap-inline">
                        <div className="min-w-0">
                          <p className="nf-body font-semibold text-content">{group.device}</p>
                          {group.deviceNote && (
                            <p className="nf-caption mt-row text-muted">{group.deviceNote}</p>
                          )}
                        </div>
                        <span className="nf-caption shrink-0 text-content-2" data-testid="device-group-count">
                          {group.count}
                        </span>
                      </div>
                      <Facts first={group.firstSignedIn} last={group.lastUsed} />
                      <Button
                        variant={armed === key ? "danger" : "secondary"}
                        size="sm"
                        full
                        onClick={() => endGroup(group)}
                        disabled={pending}
                        data-testid="device-group-end"
                        className="mt-group"
                      >
                        {armed === key ? copy.confirm : group.endLabel}
                      </Button>
                      {group.sessions.length > 1 && (
                        <div className="mt-row">
                          <Disclosure label={group.showLabel} hint={group.count} title={group.device}>
                            <ul className="space-y-row">
                              {group.sessions.map((row) => (
                                <li key={row.id} className="nf-panel nf-panel--card block p-card" data-testid="device-row">
                                  <Facts first={row.signedIn} last={row.lastSeen} />
                                  <Button
                                    variant={armed === row.id ? "danger" : "secondary"}
                                    size="sm"
                                    full
                                    onClick={() => endOne(row)}
                                    disabled={pending}
                                    className="mt-group"
                                  >
                                    {armed === row.id ? copy.confirm : copy.endThis}
                                  </Button>
                                </li>
                              ))}
                            </ul>
                          </Disclosure>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      )}

      <div className="nf-panel nf-panel--card block p-card">
        <p className="nf-body font-semibold text-content">{copy.endOthers}</p>
        <p className="nf-body-sm mt-row text-content-2">
          {othersCount === 0 ? copy.endOthersNone : copy.endOthersSub}
        </p>
        <Button
          variant={armed === "others" ? "danger" : "secondary"}
          size="sm"
          full
          onClick={endRest}
          disabled={pending || othersCount === 0}
          data-testid="devices-end-others"
          className="mt-group"
        >
          {pending && armed === null ? copy.working : armed === "others" ? copy.confirm : copy.endOthers}
        </Button>
      </div>

      <NotMePanel
        title={copy.notMeTitle}
        body={copy.notMeBody}
        button={{ idle: copy.notMe, confirm: copy.notMeConfirm, working: copy.notMeWorking }}
        copy={notMeCopy}
        locale={locale}
      />
      <div className="nf-panel nf-panel--card block p-card">
        <p className="nf-body font-semibold text-content">{copy.endEverywhere}</p>
        <p className="nf-body-sm mt-row text-content-2">{copy.endEverywhereSub}</p>
        <Button
          variant={armed === "everywhere" ? "danger" : "secondary"}
          size="sm"
          full
          onClick={endEverywhere}
          disabled={pending}
          data-testid="devices-end-everywhere"
          className="mt-group"
        >
          {armed === "everywhere" ? copy.confirm : copy.endEverywhere}
        </Button>
      </div>

      {/* The honest line, under the buttons rather than over them, because it
          is what somebody needs after they have acted rather than a warning
          that makes them hesitate before doing the right thing. */}
      <p className="nf-caption text-muted">{copy.caveat}</p>
    </div>
  );
}

function Facts({ first, last }: { first: string; last: string }) {
  if (!first && !last) return null;
  return (
    <dl className="mt-row space-y-row">
      {first && (
        <div className="flex items-center gap-inline-tight">
          <UiIcon name="key" size="xs" />
          <dd className="nf-body-sm text-content-2">{first}</dd>
        </div>
      )}
      {last && (
        <div className="flex items-center gap-inline-tight">
          <UiIcon name="history" size="xs" />
          <dd className="nf-body-sm text-content-2">{last}</dd>
        </div>
      )}
    </dl>
  );
}
