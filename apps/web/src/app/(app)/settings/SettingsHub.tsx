"use client";

import type { HubCopy } from "@/components/app/account/settings-copy";
import { clearListingDrafts } from "@/lib/agent/listing-draft-storage";
import { initial } from "@/lib/text/initial";
import { useState } from "react";
import Link from "next/link";
import { withNext } from "@/lib/auth/next-link";
import { useRouter } from "next/navigation";
import { plural, type Locale } from "@vallo/i18n/core";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { SettingsGlyph, type SettingsGlyphName } from "@/components/app/account/SettingsGlyph";
import { ICON } from "@/components/app/Screen";
import { ROW_GLYPH, RowButton, RowLink, SettingsGroup } from "@/components/app/account/rows";
import { SocialLinks } from "@/components/ui/SocialLinks";
import { liveSocials } from "@/lib/brand/socials";
import { useThemeChoice } from "@/lib/theme/theme-client";
import { LanguageRow } from "@/components/app/account/SettingsGroups";
import { DataSaverRow } from "@/components/app/account/DataSaverRow";
import { useNfSettings } from "@/components/app/account/settings-store";
import { clearPacks } from "@/lib/offline/pack-store";
import { clearShelf } from "@/lib/offline/shelf-store";
import { clearOutbox } from "@/lib/offline/outbox";
import { forgetKeptPages } from "@/lib/offline/page-cache";
import { forgetWidget } from "@/lib/native/widget";
import { revokeWidgetTokens } from "@/lib/native/widget-actions";
import { clearAllInflight } from "@/lib/offline/inflight";
import { signOut } from "@/lib/profile/actions";
import { clearLocalDevice, readLocalDevice } from "@/components/app/push/device-state";
import { playThreshold } from "@/lib/motion/threshold";
import type { ResolvedProfileSettings } from "@/lib/profile/model";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * THE SETTINGS HOME, per `7F96BE6C`.
 *
 * The profile row, then one card of six rows, each with its glyph tile and
 * the fact it answers before it is opened: Account Information (Verified when
 * a human checked this account), Notifications (a real switch), Privacy &
 * Security (how many devices are signed in), Appearance (the theme, changed
 * in place), Language (changed in place), Help & Support. Under that the
 * payment methods block, then Log Out.
 *
 * EVERY CONTROL WRITES THROUGH THE EXISTING STORE OR ACTION. The theme goes
 * through `useThemeChoice`, which is the same mechanism the root layout reads;
 * the language sets the locale cookie through `LanguageRow`; notifications
 * write `profiles.settings` under RLS for a signed-in person and the device
 * document for anybody else; Log Out is the real `signOut` action.
 *
 * The values on the right are FACTS, never decoration. "Verified" appears only
 * when the agent record says a human was checked. The device count is the
 * real count of sessions, or nothing when the list could not be read; it is
 * never a reassuring word nobody checked.
 */

export type SettingsHubProps = {
  t: HubCopy;
  locale: Locale;
  signedIn: boolean;
  person: { name: string; email: string; avatarUrl: string; verified: boolean } | null;
  /** The account's notification channels, for a signed-in person. */
  notifications: ResolvedProfileSettings["notifications"] | null;
  /** Real count of signed-in devices, or null when it could not be read. */
  deviceCount: number | null;
  /**
   * V-50: the Phone row, drawn only when the page decided phone confirmation
   * is on for a signed-in person. Absent draws nothing (a row that leads to
   * "nothing is needed" is not drawn).
   */
  phoneRow?: { label: string; sub: string } | null;
  /** The Vallo passport row, for a signed-in person. Absent draws nothing. */
  passportRow?: { label: string; sub: string } | null;
  /**
   * The Rewards row, for a signed-in person: the Rewards page's title, and a
   * line from the rewards read saying what that page will say (`rewardsDoorSub`;
   * today "Rewards are not running yet"). Never a figure. Absent draws nothing.
   */
  rewardsRow?: { label: string; sub?: string | undefined } | null;
};

const ALL_ON: ResolvedProfileSettings["notifications"] = {
  bookings: true,
  messages: true,
  wallet: true,
  marketing: true,
};

function ProfileRow({
  t,
  person,
}: {
  t: HubCopy;
  person: SettingsHubProps["person"];
}) {
  const hub = t.settings.hub;
  if (!person) {
    return (
      <Link href={withNext("/sign-in", "/settings")} className="nf-panel nf-panel--card nf-hub-profile" data-testid="settings-profile-row">
        <span className="nf-hub-profile__avatar" aria-hidden="true">
          <UiIcon name="user" size={24} />
        </span>
        <span className="nf-hub-profile__text">
          <span className="nf-hub-profile__name">{hub.signInRow}</span>
          <span className="nf-hub-profile__email">{hub.signInRowSub}</span>
        </span>
        <UiIcon name="chevron-right" size={ICON.inline} className="nf-hub-profile__chev" />
      </Link>
    );
  }
  const monogram = initial(person.name || person.email);
  return (
    <Link href="/profile" className="nf-panel nf-panel--card nf-hub-profile" data-testid="settings-profile-row">
      <span className="nf-hub-profile__avatar" aria-hidden="true">
        {person.avatarUrl ? (
          <RemoteImage src={person.avatarUrl} alt="" width={128} height={128} sizes="64px" />
        ) : (
          <span>{monogram}</span>
        )}
      </span>
      <span className="nf-hub-profile__text">
        <span className="nf-hub-profile__name">
          {person.name || person.email}
          {person.verified ? (
            <span className="nf-hub-tick" title={t.socialProfile.verifiedTitle} role="img" aria-label={t.socialProfile.verified}>
              <UiIcon name="verified-badge" size={16} />
            </span>
          ) : null}
        </span>
        <span className="nf-hub-profile__email">{person.email}</span>
      </span>
      <UiIcon name="chevron-right" size={ICON.inline} className="nf-hub-profile__chev" />
    </Link>
  );
}

/**
 * THE ROW GLYPHS ARE LINE DRAWINGS ON THE SHARED ICON PLATE.
 *
 * `7F96BE6C` draws one lit glass tile per row with a white line glyph inside
 * it: person, bell, ticked shield, globe, headset, and the door on Log Out.
 * Until the platform sweep of 23 September the tile was the artwork itself
 * (pack objects `person-card`, `bell-tile`, `shield-check-tile`, `globe`,
 * `headset`, each carrying its own ground), which is why the row slot had to
 * stay empty to avoid two tiles, and why the column never quite matched the
 * console's plates. The founder made the console's plate the standard, so the
 * tile is now `IconPlate` (drawn by `RowGlyph` in `rows.tsx`) and the glyph is
 * a stroked line: `UiIcon` where it has the drawing, `SettingsGlyph` for the
 * four it does not. One plate, one family, on every settings row.
 */
const SETTINGS_GLYPHS = new Set<string>(["shield-check", "globe", "headset", "log-out"]);
function HubGlyph({ name }: { name: SettingsGlyphName | UiIconName }) {
  return SETTINGS_GLYPHS.has(name) ? (
    <SettingsGlyph name={name as SettingsGlyphName} size={ROW_GLYPH} />
  ) : (
    <UiIcon name={name as UiIconName} size={ROW_GLYPH} />
  );
}

/** An emerald tick beside a word: a state the platform actually checked. */
function Checked({ children }: { children: string }) {
  return (
    <span className="nf-hub-value nf-hub-value--ok">
      {children}
      <UiIcon name="verified-badge" size={16} />
    </span>
  );
}

export function SettingsHub({
  t,
  locale,
  signedIn,
  person,
  notifications,
  deviceCount,
  phoneRow = null,
  passportRow = null,
}: SettingsHubProps) {
  const hub = t.settings.hub;
  /* The appearance group and its theme row went with light mode on 23
     September. `t.settings.appearance` still exists in the dictionary and is
     now unread here; removing the keys is the i18n sweep's job, not this
     component's. */

  /* ------------------------------------------------------- notifications */
  const { settings } = useNfSettings();
  const account = notifications ?? ALL_ON;
  const notifyOn = signedIn
    ? account.bookings || account.messages || account.wallet || account.marketing
    : settings.notifyPush || settings.notifyEmail || settings.notifySms || settings.notifyWhatsapp;
  const themeChoice = useThemeChoice();
  const appearance = t.settings.appearance;
  const themeWord =
    themeChoice === "light" ? appearance.themeLight : themeChoice === "system" ? appearance.themeSystem : appearance.themeDark;
  const about = t.settings.about;

  return (
    <div className="nf-hub space-y-block" data-testid="settings-hub">
      <ProfileRow t={t} person={person} />

      {/* V-79: the data saver, at the top where people look for it. */}
      <DataSaverRow copy={t.platform.lite} />

      {/*
        THE HUB, REBUILT (track G, 25 September 2026). Six groups, and every
        row goes to a real page: nothing on this screen toggles in place any
        more, so a row always means "open this". The notifications master
        switch that stood here flipped four settings at once from a screen
        that could not show which; the page it now opens has all four.
        No wallet row: Vallo holds no money (custody retired), and the
        payments row is the cards and payout accounts a person really has.
      */}
      <SettingsGroup label="Account">
        <RowLink
          href="/settings/account"
          glyph={<HubGlyph name="user" />}
          label={hub.accountInfo}
          sub={hub.accountInfoSub}
          value={person?.verified ? <Checked>{hub.verified}</Checked> : undefined}
          testId="hub-account"
        />
        {phoneRow && (
          <RowLink
            href="/settings/phone"
            glyph={<HubGlyph name="phone" />}
            label={phoneRow.label}
            sub={phoneRow.sub}
            testId="hub-phone"
          />
        )}
        {passportRow && (
          <RowLink
            href="/settings/passport"
            glyph={<HubGlyph name="document" />}
            label={passportRow.label}
            sub={passportRow.sub}
            testId="hub-passport"
          />
        )}
      </SettingsGroup>

      <SettingsGroup label="Preferences">
        <RowLink
          href="/settings/notifications"
          glyph={<HubGlyph name="bell" />}
          label={t.settings.notifications.label}
          sub={hub.notificationsSub}
          value={notifyOn ? hub.on : hub.off}
          testId="hub-notifications"
        />
        <RowLink
          href="/settings/appearance"
          glyph={<HubGlyph name={themeChoice === "light" ? "sun" : themeChoice === "system" ? "contrast" : "moon"} />}
          label={appearance.label}
          sub={`${appearance.theme}, ${hub.appearanceSub.toLowerCase()}`}
          value={themeWord}
          testId="hub-appearance"
        />
        {/* Accessibility was a destination in the settings menu and nowhere on
            this screen, so it could not be found from here (7 October 2026). */}
        <RowLink
          href="/settings/accessibility"
          glyph={<HubGlyph name="eye" />}
          label={t.experienceSettings.accessibility.title}
          sub={t.experienceSettings.accessibility.sub}
          testId="hub-accessibility"
        />
        <LanguageRow
          t={t}
          current={locale}
          label={t.settings.language.label}
          sub={hub.languageSub}
          glyph={<HubGlyph name="globe" />}
        />
        <RowLink
          href="/settings/place"
          glyph={<HubGlyph name="location" />}
          label={t.experienceSettings.area.destinations.place}
          testId="hub-place"
        />
        <RowLink
          href="/settings/interests"
          glyph={<HubGlyph name="heart" />}
          label={t.experienceSettings.area.destinations.interests}
          testId="hub-interests"
        />
      </SettingsGroup>

      {signedIn && (
        <SettingsGroup label="VALLO AI">
          <RowLink
            href="/settings/ai-assistant"
            glyph={<HubGlyph name="bot" />}
            label="VALLO AI Assistant"
            sub="Your personal assistant. Off until you turn it on"
            testId="hub-ai-assistant"
          />
        </SettingsGroup>
      )}

      <SettingsGroup label="Privacy and security">
        <RowLink
          href="/settings/privacy"
          glyph={<HubGlyph name="shield-check" />}
          label={hub.privacy}
          sub={hub.privacySub}
          value={
            deviceCount !== null && deviceCount > 0
              ? plural(deviceCount, hub.devices, locale)
              : undefined
          }
          testId="hub-privacy"
        />
        {/* The passcode lock (docs/PASSCODE.md): change it, or its length. */}
        {signedIn && (
          <RowLink
            href="/settings/passcode"
            glyph={<HubGlyph name="key" />}
            label={t.passcode.settingsRow}
            sub={t.passcode.settingsRowSub}
            testId="hub-passcode"
          />
        )}
        {signedIn && (
          <RowLink
            href="/settings/devices"
            glyph={<HubGlyph name="key" />}
            label={t.experienceSettings.area.destinations.devices}
            testId="hub-devices"
          />
        )}
      </SettingsGroup>

      {signedIn && (
        <SettingsGroup label="Payments">
          <RowLink
            href="/settings/payments"
            glyph={<HubGlyph name="document" />}
            label={t.paymentsPage.settingsRow}
            sub="Cards you pay with, and the bank accounts you are paid into"
            testId="hub-payments"
          />
        </SettingsGroup>
      )}

      <SettingsGroup label="Help and legal">
        <RowLink
          href="/support"
          glyph={<HubGlyph name="headset" />}
          label={hub.help}
          sub={hub.helpSub}
          testId="hub-help"
        />
        <RowLink
          href="/docs"
          glyph={<HubGlyph name="document" />}
          label={about.docs}
          sub={about.docsSub}
          testId="hub-docs"
        />
        <RowLink href="/terms" glyph={<HubGlyph name="document" />} label={about.terms} testId="hub-terms" />
        <RowLink href="/privacy" glyph={<HubGlyph name="eye-off" />} label={about.privacy} testId="hub-privacy-policy" />
        <RowLink href="/ai/terms" glyph={<HubGlyph name="bot" />} label="VALLO AI terms and privacy" testId="hub-ai-terms" />
        <RowLink href="/disclaimer" glyph={<HubGlyph name="info" />} label={about.disclaimer} testId="hub-disclaimer" />
      </SettingsGroup>

      {/* Vallo's own pages (28 October 2026): drawn only for the networks that have an address. */}
      {liveSocials().length > 0 ? (
        <SettingsGroup label="Follow Vallo">
          <div className="p-card" data-testid="hub-social">
            <SocialLinks />
          </div>
        </SettingsGroup>
      ) : null}
    </div>
  );
}

/** Log Out, the last row on the screen. Real `signOut`, with its own error line. */
export function LogOutRow({ t, signedIn }: { t: HubCopy; signedIn: boolean }) {
  const router = useRouter();
  const hub = t.settings.hub;
  const [signingOut, startSignOut] = useSafeTransition();
  const [error, setError] = useState<string | null>(null);
  if (!signedIn) return null;
  return (
    <div className="nf-hub">
      <SettingsGroup
        note={
          error ? (
            <span role="alert" className="text-[var(--nf-state-error)]">
              {error}
            </span>
          ) : undefined
        }
      >
        <RowButton
          glyph={<HubGlyph name="log-out" />}
          label={signingOut ? hub.loggingOut : hub.logOut}
          disabled={signingOut}
          onClick={() => {
            setError(null);
            startSignOut(async () => {
              try {
                /* V-98: the widget stops reading this account before the session ends. */
                await revokeWidgetTokens().catch(() => undefined);
                /* The push row for THIS device is retired with the session. */
                const result = await signOut(readLocalDevice()?.deviceRef);
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                /* V-35, V-77: a shared phone keeps neither somebody else's gate code
                   nor their shortlist. */
                await clearPacks();
                await clearShelf();
                /* SUP-16: a listing draft never outlives the session that wrote it. */
                clearListingDrafts();
                await clearOutbox();
                /* The pages this phone kept for offline go with the session. */
                await forgetKeptPages();
                await forgetWidget();
                clearAllInflight();
                clearLocalDevice();
                /* Track M: the page recedes and the panels close on the mark. */
                await playThreshold("leave");
                router.replace("/");
                router.refresh();
              } catch (error) {
                if (!tapFailedOffline(error)) throw error;
              }
            });
          }}
          testId="hub-logout"
        />
      </SettingsGroup>
    </div>
  );
}
