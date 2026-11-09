import type { Metadata } from "next";
import { withNext } from "@/lib/auth/next-link";
import { getDictionary, plural, type Dictionary, type Locale } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { PageFrame } from "@/components/app/PageFrame";
import { loadSessions, type DeviceSession } from "@/lib/security/sessions";
import { sessionWhen } from "@/lib/security/when";
import { phrase } from "./when-words";
import { groupSessions, type SessionGroup } from "@/lib/security/session-groups";
import { DeviceList, type DeviceGroupRow, type DeviceRow } from "./DeviceList";
import { EmptyState } from "@/components/app/Screen";
import { EmptyActions } from "@/components/app/EmptyActions";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: getDictionary(await getLocale()).settings.devices.screenTitle,
    robots: { index: false, follow: false },
  };
}

/*
 * Never cached, and this is the one screen where that is a security property
 * rather than a freshness one. A session list served from a cache is a list of
 * devices that were signed in at some point in the past, shown to somebody who
 * is deciding right now whether to trust what is on it.
 */
export const dynamic = "force-dynamic";

/**
 * Where you are signed in. SEC-5.
 *
 * The account can start payments and change payout details, so this is not a
 * settings nicety. A phone left in a taxi is either recoverable by its owner
 * in thirty seconds or it becomes a support ticket, and a support ticket is a
 * stranger deciding whether to believe you.
 *
 * ## What is on this screen, and what is deliberately not
 *
 * Each row carries when the session began, when it was last used, and the
 * device where we honestly have one. There is NO location, not even an
 * approximate one, and its absence is the considered answer rather than a gap:
 * `auth.sessions.ip` records whoever last refreshed the token, the refresh runs
 * in our own middleware, so the address on the row is a data centre's. A city
 * drawn from that would be a confident lie in the one place a person is making
 * a security decision. `lib/security/sessions.ts` carries the full reasoning
 * and `my_sessions()` does not return the column at all.
 *
 * The formatting all happens here rather than in the client component below.
 * The actions call `revalidatePath` and this re-renders, so the list is server
 * truth after every button; a client component holding its own copy of the
 * sessions would be one stale render away from telling somebody a device they
 * just ended is still signed in.
 */
export default async function DevicesPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const copy = t.settings.devices;
  const fold = t.platform.devices;
  const state = await loadSessions();

  if (state.state !== "signed-in") {
    return (
      <PageFrame title={copy.screenTitle} fallback="/settings" width="narrow">
        <EmptyState
          icon="globe-pin"
          title={copy.accountTitle}
          body={state.state === "unconfigured" ? copy.accountBodyUnconfigured : copy.accountBodySignedOut}
          {...(state.state === "signed-out"
            ? { action: <EmptyActions primary={{ label: t.common.signIn, href: withNext("/sign-in", "/settings/devices") }} /> }
            : {})}
        />
      </PageFrame>
    );
  }

  /*
   * V-19: ONE LINE PER DEVICE TYPE. The QA member holds 91 sessions, 89 of
   * them our own middleware's refreshes. One card per row buried the one line
   * a person is looking for, so the rows are folded (`session-groups.ts`) and
   * each line can still be opened to its sessions. The clock comes from the
   * read, not from the render. See `SessionsState`.
   */
  const { current, groups } = groupSessions(state.sessions);
  const currentRow = current ? toRow(current, t, state.readAt) : null;
  const groupRows = groups.map((group) => toGroupRow(group, t, locale, state.readAt));

  return (
    <PageFrame title={copy.screenTitle} fallback="/settings" width="narrow" testId="devices-settings">
      <DeviceList
        current={currentRow}
        groups={groupRows}
        othersCount={state.sessions.filter((session) => !session.isCurrent).length}
        readable={state.readable}
        copy={{
          intro: copy.intro,
          caveat: copy.caveat,
          endThis: copy.endThis,
          endCurrent: copy.endCurrent,
          endOthers: copy.endOthers,
          endOthersSub: copy.endOthersSub,
          endOthersNone: copy.endOthersNone,
          endEverywhere: copy.endEverywhere,
          endEverywhereSub: copy.endEverywhereSub,
          confirm: copy.confirm,
          working: copy.working,
          endedOne: copy.endedOne,
          endedOthers: copy.endedOthers,
          endedNone: copy.endedNone,
          unreadable: copy.unreadable,
          currentTitle: fold.currentTitle,
          othersTitle: fold.othersTitle,
          othersEmpty: fold.othersEmpty,
          strangerHint: fold.strangerHint,
          groupFailed: fold.groupFailed,
          endedGroup: fold.endedGroup,
          notMeTitle: fold.notMeTitle,
          notMeBody: fold.notMeBody,
          notMe: fold.notMe,
          notMeConfirm: fold.notMeConfirm,
          notMeWorking: fold.notMeWorking,
        }}
        notMeCopy={t.platform.notMe}
        locale={locale}
      />
    </PageFrame>
  );
}

/** A folded line: the device, how many, first and last, and its sessions. */
function toGroupRow(
  group: SessionGroup<DeviceSession>,
  t: Dictionary,
  locale: Locale,
  now: number,
): DeviceGroupRow {
  const fold = t.platform.devices;
  const first = group.sessions[0];
  const described = first ? toRow(first, t, now) : null;
  const count = group.sessions.length;
  return {
    key: group.key,
    device: described?.device ?? t.settings.devices.deviceUnknown,
    deviceNote: described?.deviceNote,
    count: plural(count, fold.sessions, locale),
    firstSignedIn: phrase(fold.firstSignedIn, sessionWhen(group.firstSignedInAt, now), t),
    lastUsed: phrase(fold.lastUsed, sessionWhen(group.lastSeenAt, now), t),
    endLabel: plural(count, fold.endGroup, locale),
    showLabel: fold.showSessions,
    sessionIds: group.sessions.map((session) => session.id),
    sessions: group.sessions.map((session) => toRow(session, t, now)),
  };
}

/**
 * One session, turned into the four strings the list draws.
 *
 * The device name is assembled from the fixed proper nouns `describeDevice`
 * returns, never from the raw `User-Agent`. That header is written by whoever
 * signs in, and an attacker who can put their own sentence into the row labelled
 * "Device" has a free line of copy on a security screen. See
 * `lib/security/device.ts`.
 */
function toRow(session: DeviceSession, t: Dictionary, now: number): DeviceRow {
  const copy = t.settings.devices;
  const security = t.settings.security;
  const { kind, browser, platform } = session.device;

  const device =
    kind === "device"
      ? security.deviceOn
          .replace("{browser}", browser ?? security.unknownBrowser)
          .replace("{os}", platform ?? security.unknownOs)
      : kind === "unrecognised"
        ? copy.deviceUnrecognised
        : copy.deviceUnknown;

  /* Only the rows that genuinely do not know say why. An unrecognised agent is
     a real device we could not name and needs no apology; a `server` or
     `unrecorded` row is our own architecture showing through, and a person
     asked "do you recognise this?" about it deserves to be told. */
  const deviceNote = kind === "server" || kind === "unrecorded" ? copy.deviceUnknownSub : undefined;

  return {
    id: session.id,
    isCurrent: session.isCurrent,
    device,
    deviceNote,
    thisDevice: copy.thisDevice,
    signedIn: phrase(copy.signedInAt, sessionWhen(session.signedInAt, now), t),
    lastSeen: phrase(copy.lastSeenAt, sessionWhen(session.lastSeenAt, now), t),
  };
}
