"use client";

import { useCallback, useState } from "react";
import { setLite } from "@/lib/ui/lite";
import { RowSelect, RowSwitch, SettingsGroup } from "@/components/app/account/rows";
import { banner } from "@/lib/ui/toast";
import { updateSettings } from "@/lib/profile/actions";
import type { NotifyToggleCopy, PrivacyToggleCopy } from "@/components/app/account/settings-copy";
import type { ResolvedProfileSettings, SettingsPatch } from "@/lib/profile/schema";
import type { VisibilityLevel } from "@/lib/profile/model";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * Account-backed preference groups.
 *
 * These render only for a signed-in person on a configured platform. Each flip
 * is optimistic: the switch moves at once, the patch goes to updateSettings
 * which deep-merges it into profiles.settings under row level security, and a
 * refusal puts the switch back exactly where it was with a banner saying what
 * happened. Signed out, the settings page renders the on-device cards instead,
 * unchanged, so nothing about that world moves.
 */

/**
 * Shared save behaviour: optimistic and reverting. What a save says goes to
 * the one feedback banner at the top of the screen (Grade 1, UX_SYSTEM 8.1),
 * so a confirmation never pushes the switches down while somebody is still
 * flipping them. A refusal puts the switch back and says why there too.
 */
function useSettingsSaver(savedText: string) {
  const [pending, startTransition] = useSafeTransition();

  const save = useCallback((patch: SettingsPatch, revert: () => void) => {
    startTransition(async () => {
      try {
        const result = await updateSettings(patch);
        if (result.ok) {
          banner(savedText, { tone: "success", "data-testid": "settings-saved" });
          return;
        }
        revert();
        banner.error(result.error);
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }, [savedText]);

  return { save, pending };
}

/* --------------------------------------------------------- notifications */

type NotifyKey = "bookings" | "messages" | "payments" | "marketing" | "savedPriceDrops";

/**
 * Where each switch is stored in `profiles.settings.notifications`.
 *
 * The Payments switch is persisted under the key `wallet`, a name from the
 * retired custody model (D48). Renaming a persisted key needs a migration
 * that carries every member's existing choice across, and that migration is
 * Session 2's (R3-31). Until it lands the switch reads and writes `wallet`, so
 * nobody's saved preference is lost, and the name never reaches a screen.
 */
const STORED = {
  bookings: "bookings",
  messages: "messages",
  payments: "wallet",
  marketing: "marketing",
  savedPriceDrops: "savedPriceDrops",
} as const satisfies Record<NotifyKey, keyof ResolvedProfileSettings["notifications"]>;

/**
 * The same four switches, described from where you are standing.
 *
 * A host reading "changes to your trips" under Agent Mode would reasonably
 * assume it was about trips they had booked, not about the guests arriving at
 * their property. One preference, two honest descriptions of it, which is why
 * the dictionary carries `notify.guest` and `notify.host` rather than one set
 * of words and a component that tries to bend them.
 */
export function AccountNotificationsCard({
  t,
  initial,
  variant = "guest",
}: {
  /* Handed down from whichever server component resolved the locale: /settings
     for a guest, /agent/settings for a host. */
  t: NotifyToggleCopy;
  initial: ResolvedProfileSettings["notifications"];
  /** Whose words to use. The preference itself is one account-wide setting. */
  variant?: "guest" | "host";
}) {
  const [value, setValue] = useState(initial);
  const { save, pending } = useSettingsSaver(t.settings.account.saved);
  const words = t.settings.notify[variant];
  const copy: Record<NotifyKey, [string, string]> = {
    bookings: [words.bookings, words.bookingsSub],
    messages: [words.messages, words.messagesSub],
    payments: [words.payments, words.paymentsSub],
    marketing: [words.marketing, words.marketingSub],
    savedPriceDrops: [words.savedPriceDrops, words.savedPriceDropsSub],
  };

  const flip = (key: NotifyKey, next: boolean) => {
    const previous = value;
    const stored = STORED[key];
    setValue({ ...value, [stored]: next });
    save({ notifications: { [stored]: next } }, () => setValue(previous));
  };

  /* Payments covers payment and receipt emails, so the glyph is a document. */
  const ICON: Record<NotifyKey, "calendar-booking" | "chat-bubble" | "document" | "mail" | "price-tag"> = {
    bookings: "calendar-booking",
    messages: "chat-bubble",
    payments: "document",
    marketing: "mail",
    savedPriceDrops: "price-tag",
  };

  const row = (key: NotifyKey) => {
    const [label, description] = copy[key];
    return (
      <RowSwitch
        icon={ICON[key]}
        label={label}
        sub={description}
        checked={value[STORED[key]] ?? true}
        onChange={(next) => flip(key, next)}
        disabled={pending}
      />
    );
  };

  return (
    <SettingsGroup label={t.settings.notifications.label}>
      {row("bookings")}
      {row("messages")}
      {row("payments")}
      {/* B13: guests only; a host's listings are not somebody's saves. */}
      {variant === "guest" ? row("savedPriceDrops") : null}
      {row("marketing")}
    </SettingsGroup>
  );
}

/* --------------------------------------------------------------- privacy */

export function AccountPrivacyCard({
  t,
  initialPrivacy,
  initialDataSaver,
}: {
  t: PrivacyToggleCopy;
  initialPrivacy: ResolvedProfileSettings["privacy"];
  initialDataSaver: boolean;
}) {
  const [hideActivity, setHideActivity] = useState(initialPrivacy.hideActivity);
  const [showOccupation, setShowOccupation] = useState(initialPrivacy.showOccupation);
  const [showHomeTown, setShowHomeTown] = useState(initialPrivacy.showHomeTown);
  const [profileVisibility, setProfileVisibility] = useState(initialPrivacy.profileVisibility);
  const [messagingAccess, setMessagingAccess] = useState(initialPrivacy.messagingAccess);
  const [contactDiscovery, setContactDiscovery] = useState(initialPrivacy.contactDiscovery);
  const [dataSaver, setDataSaver] = useState(initialDataSaver);
  const { save, pending } = useSettingsSaver(t.settings.account.saved);
  const copy = t.settings.notify;

  const visibilityOptions: { value: VisibilityLevel; label: string }[] = [
    { value: "everyone", label: copy.visibilityEveryone },
    { value: "verified", label: copy.visibilityVerified },
    { value: "connections", label: copy.visibilityConnections },
  ];

  return (
    <SettingsGroup label={t.settings.privacy.label}>
      <RowSelect
        icon="eye"
        label={copy.profileVisibility}
        sub={copy.profileVisibilitySub}
        value={profileVisibility}
        options={visibilityOptions}
        onChange={(next) => {
          const previous = profileVisibility;
          setProfileVisibility(next);
          save({ privacy: { profileVisibility: next } }, () => setProfileVisibility(previous));
        }}
      />
      <RowSelect
        icon="chat-bubble"
        label={copy.messagingAccess}
        sub={copy.messagingAccessSub}
        value={messagingAccess}
        options={visibilityOptions}
        onChange={(next) => {
          const previous = messagingAccess;
          setMessagingAccess(next);
          save({ privacy: { messagingAccess: next } }, () => setMessagingAccess(previous));
        }}
      />
      <RowSwitch
        icon="search"
        label={copy.contactDiscovery}
        sub={copy.contactDiscoverySub}
        checked={contactDiscovery}
        onChange={(next) => {
          const previous = contactDiscovery;
          setContactDiscovery(next);
          save({ privacy: { contactDiscovery: next } }, () => setContactDiscovery(previous));
        }}
        disabled={pending}
      />
      <RowSwitch
        icon="user"
        label={copy.hideActivity}
        sub={copy.hideActivitySub}
        checked={hideActivity}
        onChange={(next) => {
          const previous = hideActivity;
          setHideActivity(next);
          save({ privacy: { hideActivity: next } }, () => setHideActivity(previous));
        }}
        disabled={pending}
      />
      {/* V-64: private by default, one switch per fact. */}
      <RowSwitch
        icon="user"
        label={t.shape.profile.showOccupation}
        sub={t.shape.profile.showOccupationSub}
        checked={showOccupation}
        onChange={(next) => {
          const previous = showOccupation;
          setShowOccupation(next);
          save({ privacy: { showOccupation: next } }, () => setShowOccupation(previous));
        }}
        disabled={pending}
      />
      <RowSwitch
        icon="location"
        label={t.shape.profile.showHomeTown}
        sub={t.shape.profile.showHomeTownSub}
        checked={showHomeTown}
        onChange={(next) => {
          const previous = showHomeTown;
          setShowHomeTown(next);
          save({ privacy: { showHomeTown: next } }, () => setShowHomeTown(previous));
        }}
        disabled={pending}
      />
      <RowSwitch
        icon="compass"
        label={copy.dataSaver}
        sub={copy.dataSaverSub}
        checked={dataSaver}
        onChange={(next) => {
          const previous = dataSaver;
          setDataSaver(next);
          /* V-79: the cookie the server reads, and the device setting. */
          setLite(next);
          save({ dataSaver: next }, () => setDataSaver(previous));
        }}
        disabled={pending}
      />
    </SettingsGroup>
  );
}
