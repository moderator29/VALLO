import { phoneConfirmationOn } from "@/lib/phone-otp/flag";
import { isQaTester } from "@/lib/phone-otp/qa";
import { forHub } from "@/components/app/account/settings-copy";
import type { Metadata } from "next";
import { distinctDeviceCount } from "@/lib/security/device-count";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { PageFrame } from "@/components/app/PageFrame";
import { loadProfileState } from "@/lib/profile/queries";
import { loadSessions } from "@/lib/security/sessions";
import { getAgentContext } from "@/lib/agent/listings-queries";
import { LogOutRow, SettingsHub } from "./SettingsHub";
import { inviteRewards } from "@/lib/referral/rewards";
import { readMyRewards } from "@/lib/referral/rewards-read";
import { rewardsDoorSub } from "@/components/app/referral/rewards-door";

export async function generateMetadata(): Promise<Metadata> {
  // Static metadata cannot read the locale cookie, so the tab said "Settings"
  // to a Hausa reader whose whole screen was in Hausa.
  return { title: getDictionary(await getLocale()).nav.settings };
}

/**
 * Settings, the home, to `7F96BE6C`.
 *
 * The headline and its line, the profile row, the six hub rows, the payment
 * methods block, Log Out. It used to be every preference on one screen, four
 * thousand pixels of it; the preferences are all still here, one tap down,
 * grouped under the row that names them: `/settings/account`,
 * `/settings/notifications`, `/settings/privacy`, `/settings/appearance` and
 * `/settings/help`.
 *
 * The search field that sat under the headline is gone from this screen: the
 * render has none, and six rows do not need one. The account screen keeps
 * its search over the preferences it holds (`./account`).
 *
 * Two worlds, one screen. Signed in on a configured platform the hub's switch
 * writes `profiles.settings` under row level security; signed out, or before
 * the platform keys land, it writes the device document, exactly as before.
 */
export default async function SettingsPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const [account, sessions, agentContext, rewardsRead] = await Promise.all([
    loadProfileState(),
    loadSessions(),
    getAgentContext(),
    /* The Rewards row's line. Today the read answers not-live and calls nothing. */
    readMyRewards(),
  ]);
  const signedIn = account.state === "signed-in";
  const profile = signedIn ? account.profile : null;

  /* Null, not zero, when the list could not be read. A row reading "0
     devices" to somebody reading it while signed in is a worse lie than no
     number at all. */
  const deviceCount =
    sessions.state === "signed-in" && sessions.readable ? distinctDeviceCount(sessions.sessions) : null;

  /* "Verified" means a human was checked, and the one record of that on this
     platform is an APPROVED, verified agent. Nobody else gets the word. */
  const verified = agentContext.state === "agent" && agentContext.agent.verified;

  const hub = t.settings.hub;

  return (
    /*
      THE WAY BACK. `/settings` declares `/home` above it in
      `lib/nav/route-parents.ts`, every screen UNDER it is on the same
      `PageFrame` with a back control, and so is the hub: the large title
      (section 8.1) carries the same back control, so the settings tree has a
      way up at its top and the head matches Saved, Inbox and Bookings.
    */
    <PageFrame title={t.nav.settings} subtitle={hub.ledeShort} fallback="/home" width="narrow">
      <div className="space-y-block">
        <SettingsHub
          t={forHub(t)}
          locale={locale}
          signedIn={signedIn}
          person={
            profile
              ? {
                  name:
                    profile.displayName ||
                    [profile.firstName, profile.surname].filter(Boolean).join(" "),
                  email: profile.email,
                  avatarUrl: profile.avatarUrl,
                  verified,
                }
              : null
          }
          notifications={profile ? profile.settings.notifications : null}
          deviceCount={deviceCount}
          phoneRow={
            /* A QA account is never asked for a phone, so it is not shown the door. */
            signedIn && (await phoneConfirmationOn()) && !(await isQaTester(profile?.userId))
              ? { label: t.trustVisible.phone.title, sub: t.trustVisible.phone.subtitle }
              : null
          }
          passportRow={
            signedIn ? { label: t.passportV2.title, sub: t.passportV2.subtitle } : null
          }
          rewardsRow={
            signedIn
              ? {
                  label: t.experienceRewards.title,
                  sub: rewardsDoorSub(inviteRewards(rewardsRead), t.experienceRewards),
                }
              : null
          }
        />

        {/* The payment methods block that stood here is a row in the hub
            now (Payments), opening `/settings/payments`, which renders the
            same block: the hub is a list of doors, not a second copy of a
            screen (track G). */}

        <LogOutRow t={forHub(t)} signedIn={signedIn} email={profile?.email || undefined} />
      </div>
    </PageFrame>
  );
}
