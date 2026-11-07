import type { Metadata } from "next";
import { forAddressMove, forPrivacyCard, forPrivacyToggles, forSecurityCard } from "@/components/app/account/settings-copy";
import { distinctDeviceCount } from "@/lib/security/device-count";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { PageFrame } from "@/components/app/PageFrame";
import { PrivacyCard, SecurityCard } from "@/components/app/account/SettingsGroups";
import { SettingsLede } from "@/components/app/account/SettingsLede";
import { SettingsInnerNav } from "@/components/app/account/SettingsInnerNav";
import { loadSettingsState } from "@/lib/profile/queries";
import { loadSessions } from "@/lib/security/sessions";
import { AccountPrivacyCard } from "../AccountToggles";
import { DevicesRow } from "../DevicesCard";
import { loadMoneyHoldUntil, loadPendingAddressMove } from "@/lib/auth/pending-address-move";
import { PendingAddressMove } from "./PendingAddressMove";
import { countMyBlocks } from "@/lib/safety/blocks-queries";
import { RowLink, SettingsGroup } from "@/components/app/account/rows";
import { withNext } from "@/lib/auth/next-link";
import { MONEY_LOCK_ROW } from "@/lib/money/copy";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).settings.hub.privacy };
}

/**
 * Privacy & Security: what other people can see, where you are signed in, and
 * who you have blocked. It carried EIGHT groups on one screen; the other
 * three jobs are pages of their own now (D25: when a screen carries more than
 * one job, the second becomes an inner page), one tap down:
 *
 *   `./money-lock`   face or fingerprint before money moves
 *   `./ai`           the assistant agreement, and taking it back
 *   `./data`         a copy of your data, and clearing this device
 *
 * Every control is unchanged; only where it lives moved. The glass navigation
 * at the top jumps between the sections that remain.
 */
export default async function PrivacySettingsPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const copy = t.experienceAccount.settings;
  const [account, sessions, pendingMove, moneyHoldUntil, blockedCount] = await Promise.all([
    loadSettingsState(),
    loadSessions(),
    loadPendingAddressMove(locale),
    loadMoneyHoldUntil(locale),
    countMyBlocks().catch(() => null),
  ]);
  const signedIn = account.state === "signed-in";
  const deviceCount =
    sessions.state === "signed-in" && sessions.readable ? distinctDeviceCount(sessions.sessions) : null;

  return (
    <PageFrame title={t.settings.hub.privacy} subtitle={t.settings.hub.privacySub} fallback="/settings" width="narrow">
      {/* One child: the lede and the inner nav keep their 16px foot. */}
      <div>
      <SettingsLede label={copy.lede.what} what={copy.lede.privacy.what} who={copy.lede.privacy.who} />
      <SettingsInnerNav
        label={copy.nav.label}
        toggleLabel={copy.nav.toggle}
        currentLabel={t.settings.hub.privacy}
        sections={[
          { id: "settings-privacy", label: copy.privacy.navVisible, icon: "eye" },
          { id: "settings-security", label: copy.privacy.navSecurity, icon: "shield-check" },
          { id: "settings-more", label: copy.privacy.navMore, icon: "more" },
        ]}
      />
      <div className="space-y-block">
        {moneyHoldUntil && (
          <section id="settings-money-hold" className="scroll-mt-28">
            <div role="status" className="nf-panel nf-panel--card grid gap-sm p-card">
              <h2 className="font-semibold">{t.settings.moneyHold.title.replace("{when}", moneyHoldUntil)}</h2>
              <p className="text-[length:var(--nf-text-body-sm)]">{t.settings.moneyHold.body}</p>
            </div>
          </section>
        )}
        {pendingMove && (
          <section id="settings-address-move" className="scroll-mt-28">
            <PendingAddressMove t={forAddressMove(t)} move={pendingMove} />
          </section>
        )}
        <section id="settings-privacy" className="scroll-mt-28">
          {signedIn ? (
            <AccountPrivacyCard
              t={forPrivacyToggles(t)}
              initialPrivacy={account.settings.privacy}
              initialDataSaver={account.settings.dataSaver}
            />
          ) : (
            <PrivacyCard t={forPrivacyCard(t)} />
          )}
        </section>
        <section id="settings-security" className="scroll-mt-28">
          <SecurityCard t={forSecurityCard(t)}>
            <DevicesRow t={t} signedIn={signedIn} count={deviceCount} />
            {/* DB2: the people you blocked, with Unblock, one tap away. */}
            <RowLink
              href={signedIn ? "/settings/privacy/blocked" : withNext("/sign-in", "/settings/privacy/blocked")}
              icon="block"
              label={t.settings.blocked.rowLabel}
              sub={signedIn ? t.settings.blocked.rowNote : t.settings.blocked.signedOut}
              value={
                !signedIn || blockedCount === null
                  ? undefined
                  : blockedCount === 0
                    ? t.settings.blocked.rowValueNone
                    : blockedCount === 1
                      ? t.settings.blocked.rowValueOne
                      : t.settings.blocked.rowValueMany.replace("{count}", String(blockedCount))
              }
              testId="settings-blocked-row"
            />
          </SecurityCard>
        </section>
        {/* The three groups that were crammed into this screen, now doors. */}
        <section id="settings-more" className="scroll-mt-28">
          <SettingsGroup label={copy.privacy.moreLabel}>
            {/* V-81: face or fingerprint as the lock on money. */}
            <RowLink
              href="/settings/privacy/money-lock"
              icon="lock"
              label={t.platform.moneyLock.settingsTitle}
              sub={MONEY_LOCK_ROW}
              testId="settings-money-lock-row"
            />
            {/* STORE-07: the AI disclosure, and the way to withdraw it. */}
            <RowLink
              href="/settings/privacy/ai"
              icon="bot"
              label={t.settings.aiConsent.label}
              sub={copy.privacy.aiSub}
              testId="settings-ai-row"
            />
            <RowLink
              href="/settings/privacy/data"
              icon="document"
              label={t.settings.data.label}
              sub={copy.privacy.dataSub}
              testId="settings-data-row"
            />
          </SettingsGroup>
        </section>
      </div>
      </div>
    </PageFrame>
  );
}
