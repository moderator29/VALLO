/* C6's member CSS move (6 October): the member-only sheets that left
   `globals.css`, the ones this tree draws, in their old globals order. They
   are the first imports so they keep their old place in the cascade: after
   every global partial, before any sheet this tree's components import. */
import "@/app/social.css";
import "@/app/social-feed.css";
import "@/app/css/motion.css";
import "@/app/css/passcode.css";
import "@/app/css/photo-viewer.css";
import "@/app/css/filter-tiles.css";
import "@/app/css/threads.css";
import "@/app/css/member-kit.css";
import "@/app/css/money-history.css";
import "@/app/css/flow-m.css";
import "@/app/css/detail-m.css";
import "@/app/css/member-loop.css";
import { getDictionary, type Locale } from "@vallo/i18n";
import { VitalsReporter } from "@/components/app/VitalsReporter";
import { DataMeterRecorder } from "@/components/app/DataMeterRecorder";
import { OfflineTray } from "@/components/app/OfflineTray";
import { CompareTray } from "@/components/app/compare/CompareTray";
import { WidgetBridge } from "@/components/app/WidgetBridge";
import { ContrastSync } from "@/components/app/account/ContrastSync";
import { MemberKeys } from "@/components/app/MemberKeys";
import { getLocale } from "@/lib/locale";
import { getShellIdentity, getShellWorkspaces } from "@/lib/app/shell-queries";
import { getSide } from "@/lib/side";
import { shellDictionary } from "@/lib/i18n/shell-dictionary";
import { AppShell } from "@/components/app/AppShell";
import { PasscodeGate, passkeyOfferedThisRequest } from "@/components/passcode/PasscodeGate";
import { resolvePasscodeGate } from "@/lib/passcode/state";
import { isSocialEnabled } from "@/lib/social/flag";
import { CallLayerMount } from "@/components/calls/CallLayerMount";
/* C12: the feed's motion sheet, out of `globals.css`; only this tree draws a post. */
import "@/app/css/feed-m.css";

import type { Metadata } from "next";

/**
 * NOTHING UNDER THIS LAYOUT IS FOR A CRAWLER, AND THE TAG NOW SAYS SO.
 *
 * The root layout used to declare `robots: { index: true, follow: true }`
 * (UI-16 removed it: no tag is the indexable default, and stating it put
 * "index, follow" beside a not-found page's "noindex"). That was right when
 * browsing was open: `/search`, `/listing/[id]`, `/around`,
 * `/stays` and `/stay/[id]` were the inventory we wanted found. The founder's
 * item 8 of 23 September closed all of them, and roughly half the routes under
 * this group had no robots directive of their own, so they went on inheriting
 * an invitation to index a page the gate would refuse.
 *
 * No crawler can act on that, because `proxy.ts` answers a signed-out request
 * with a 307 to `/sign-in` and the HTML is never served. It is fixed here
 * anyway, for two reasons. A tag that contradicts the gate is a tag the next
 * person reads and believes. And the day one of these routes is deliberately
 * reopened, the safe default is the one that has to be switched ON rather than
 * the one somebody has to remember to switch off.
 *
 * ONE PLACE RATHER THAN THIRTY. Next merges metadata down the tree, so a page
 * that states its own `robots` still wins: the pages that already carry
 * `index: false` are unaffected, and any page deliberately reopened states it
 * here. The public site (landing, company and legal pages) carries no tag and
 * is indexed by default, as it must be.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * The consumer layout, for both sides.
 *
 * Wraps every consumer route in `AppShell` so the rail and tab bar are present
 * on all of them, not just home. This is a route group, so it adds the chrome
 * without changing any URL. Locale and dictionary are resolved once here and
 * handed down; the active destination is worked out inside the shell from the
 * current path.
 *
 * The shell is a client component, so the two facts it cannot fetch itself, who
 * is signed in and how many notifications they have not read, are resolved here
 * on the server and passed down. The name used to be a hardcoded "Guest" whose
 * own comment said "until real sessions land", which stopped being true the day
 * auth shipped, so every signed-in user was greeted by the placeholder.
 */
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  /*
   * SPEED-3: the passcode gate's `passcode_status` read starts NOW, in
   * parallel with the shell's reads, rather than after them when
   * `PasscodeGate` renders. It is memoised per request, so the gate awaits
   * this same promise and still decides (and still fails closed) on its own.
   * A preload only: nothing here waits on it.
   */
  void resolvePasscodeGate().catch(() => undefined);
  /* The startup track (13 October 2026): the gate's key read joins it, for
     the same reason. It used to wait for the gate's decision, in series. */
  void passkeyOfferedThisRequest();
  /* NO PHONE STEP AT THE DOOR (founder, 6 November 2026). The number is
     asked at the first deal by the moments gate (`lib/phone-otp/gate.ts`),
     never before a member may use the app. `/sign-up/phone` still works for
     anyone who opens it, and Settings, Phone is where it is added any time. */
  const locale: Locale = await getLocale();
  const t = getDictionary(locale);
  /*
   * The side (Property or Stays) is a cookie, read once here and handed to the
   * shell, which computes the EFFECTIVE side from the path so a side-owned URL
   * always wins. Passing the cookie value from the server is what makes the
   * first paint of every shared route agree between server and client: no
   * hydration flash, no second render to correct the accent.
   */
  /*
   * The workspace list is the third server fact the shell cannot fetch itself,
   * beside the session and the unread count. It is read here once per request
   * (React's cache keeps it to one execution) and handed down, because the
   * switch sits in two places in that shell and both must show the same list.
   *
   * IT IS WHAT THEY HOLD, NOT WHAT THEY MAY DO. Every route gates itself.
   *
   * PERF-DB 4: identity and workspaces come from ONE `shell_context()` read
   * (cached per request and shared by both getters), on a caller id verified
   * locally from the token, instead of nine PostgREST calls after a GoTrue
   * round trip. See `lib/app/shell-queries.ts`.
   */
  const [
    side,
    { userName, userHandle, unreadNotifications, avatarUrl, signedIn, isAgent, isAdmin, isHost },
    { workspaces, current },
    socialOn,
  ] = await Promise.all([getSide(), getShellIdentity(), getShellWorkspaces(), isSocialEnabled()]);

  return (
    <AppShell
      /* The shell's slice, not the whole dictionary: see shell-dictionary.ts. */
      t={shellDictionary(t)}
      side={side}
      userName={userName}
      userHandle={userHandle}
      unreadNotifications={unreadNotifications}
      avatarUrl={avatarUrl}
      signedIn={signedIn}
      isAgent={isAgent}
      isAdmin={isAdmin}
      isHost={isHost}
      workspaces={workspaces}
      currentProfile={current}
      /* North star 10 E: Around's tab, row and Create action leave the
         navigation while the `social` switch is off (fails open). */
      socialOn={socialOn}
    >
      {/* V-79: counts, on this phone only, what each page could measure. */}
      <DataMeterRecorder />
      {/* V-80: one page view in ten reports its own speed, anonymously. */}
      <VitalsReporter />
      {/* B15: the Increase contrast setting, on the root. */}
      <ContrastSync />
      {/* B17: the desktop keyboard layer (fine pointer only). */}
      <MemberKeys />
      {/* V-40: what was done offline is sent, and what was paid is resolved. */}
      <OfflineTray />
      {/* Backlog row 7: places set aside to compare, wherever the reader is. */}
      <CompareTray />
      {/* V-98: the home-screen widget's token, in the native app only. */}
      <WidgetBridge />
      {/* VC1: incoming calls on any page, and the one call surface, only
          while video_calls is on (nothing at all otherwise). */}
      <CallLayerMount />
      {/* The passcode lock (docs/PASSCODE.md): the page only when this
          session is unlocked, the lock or the setup screen otherwise. */}
      <PasscodeGate t={t} locale={locale} name={signedIn && userName !== "Guest" ? userName : ""} avatarUrl={avatarUrl}>
        {children}
      </PasscodeGate>
    </AppShell>
  );
}
