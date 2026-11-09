import type { Metadata } from "next";
import { forAccount, forSearchCard } from "@/components/app/account/settings-copy";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { PageFrame } from "@/components/app/PageFrame";
import { SearchCard } from "@/components/app/account/SettingsGroups";
import { SettingsLede } from "@/components/app/account/SettingsLede";
import { SettingsInnerNav } from "@/components/app/account/SettingsInnerNav";
import { loadSettingsState } from "@/lib/profile/queries";
import { loadInterestsState } from "@/lib/interests/queries";
import { daysLeft } from "@/lib/account-deletion/constants";
import { readDeletionScreen } from "@/lib/account-deletion/queries";
import { AccountSection } from "../AccountSection";
import { PlaceCard } from "../PlaceCard";
import { InterestsRow } from "../InterestsCard";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).settings.hub.accountInfo };
}

/**
 * Account Information: who you are signed in as, where you are and what you
 * came for, your search defaults, sign out and deletion. The rows the
 * settings home used to stack under Account, Place and Search, one tap down.
 */
export default async function AccountSettingsPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const [account, intent, deletion] = await Promise.all([
    loadSettingsState(),
    loadInterestsState(),
    // The preconditions and the thirty day clock, read on the server through
    // the caller's own RLS-bound client. Never throws: an unreadable answer
    // draws as "we cannot check this right now" rather than taking the screen
    // down. See lib/account-deletion/queries.ts.
    readDeletionScreen(),
  ]);
  const signedIn = account.state === "signed-in";
  const copy = t.experienceAccount.settings;

  return (
    <PageFrame
      title={t.settings.hub.accountInfo}
      subtitle={t.settings.hub.accountInfoSub}
      fallback="/settings"
      width="narrow"
    >
      {/* One child keeps the lede, the inner nav and the sections on their
          own rhythm (the lede and nav carry their 16px foot). */}
      <div>
      <SettingsLede label={copy.lede.what} what={copy.lede.account.what} who={copy.lede.account.who} />
      <SettingsInnerNav
        label={copy.nav.label}
        toggleLabel={copy.nav.toggle}
        currentLabel={t.settings.hub.accountInfo}
        sections={[
          { id: "settings-account", label: copy.account.navAccount, icon: "user" },
          { id: "settings-place", label: copy.account.navPlace, icon: "location" },
          { id: "settings-search", label: copy.account.navSearch, icon: "search" },
        ]}
      />
      <div className="space-y-block">
        <section id="settings-account" className="scroll-mt-28">
          <AccountSection
            t={forAccount(t)}
            locale={locale}
            state={account.state}
            email={account.state === "signed-in" ? account.email : ""}
            deletion={{
              method: deletion.method,
              blockers: deletion.blockers,
              purgeAfter: deletion.open?.purgeAfter ?? null,
              daysLeft: deletion.open ? daysLeft(deletion.open.purgeAfter) : 0,
              unavailable: deletion.state === "unavailable",
            }}
          />
        </section>
        <section id="settings-place" className="scroll-mt-28">
          <PlaceCard
            t={t}
            signedIn={signedIn}
            stateName={signedIn ? account.place.stateName : ""}
            lgaName={signedIn ? account.place.lgaName : ""}
            occupationName={signedIn ? account.place.occupationName : ""}
          >
            <InterestsRow
              t={t}
              signedIn={signedIn}
              interests={intent.state === "signed-in" ? intent.interests : []}
              asked={intent.state === "signed-in" ? intent.asked : false}
            />
          </PlaceCard>
        </section>
        <section id="settings-search" className="scroll-mt-28">
          <SearchCard t={forSearchCard(t)} />
        </section>
      </div>
      </div>
    </PageFrame>
  );
}
