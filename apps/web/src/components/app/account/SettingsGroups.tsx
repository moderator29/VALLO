"use client";

import type { AppearanceCopy, DataCardCopy, LanguageCopy, NotificationsCardCopy, PrivacyCardCopy, SearchCardCopy, SecurityCardCopy } from "./settings-copy";
import { useState, useTransition, type ReactNode } from "react";
import { setLite } from "@/lib/ui/lite";
import { useRouter } from "next/navigation";
import { LOCALES, localeMeta, type Locale } from "@vallo/i18n/core";
import { LOCALE_COOKIE } from "@/lib/locale.constants";
import { updateSettings } from "@/lib/profile/actions";
import { NIGERIAN_STATES } from "@/lib/data/nigeria";
import { saveDisplayPreferences } from "@/lib/currency/actions";
import type { DistanceUnit } from "@/lib/currency/distance";
import { RowButton, RowLink, RowSelect, RowSwitch, RowValue, SettingsGroup } from "./rows";
import { useClientMount } from "@/lib/ui/client-mount";
import {
  useApplyDeviceSettings,
  useNfSettings,
  type TextSize,
} from "./settings-store";

/**
 * The settings groups, as rows.
 *
 * These were seven cards, each with a 44px illustrated tile, an overline, and
 * its own inner layout: a segmented chip row here, a bare `<select>` there, a
 * full-width button somewhere else. Every group was defensible and the stack
 * had no rhythm at all. On a 390px phone it read as seven separate screens
 * stacked, and finding one preference meant reading all of them.
 *
 * Now every group is the same object: a quiet label outside a card, and inside
 * it rows that all begin at the same vertical. The change that matters most is
 * that **a row states its own value**. "Theme" told you nothing; "Theme   Dark"
 * has answered before you touched it, and most visits to a settings screen are
 * to check something rather than to change it.
 *
 * The single-choice controls became native selects rather than chip rows.
 * Three chips for a theme were fine; three chips for a theme, three for text
 * size, two for units and two for visibility were ten chips competing for the
 * same attention. A select collapses each to its answer and opens the picker
 * the phone already has.
 *
 * Everything on this file is stored on the device and applies to the device.
 * The account-backed groups live in `app/(app)/settings/AccountToggles.tsx` and
 * draw from the same primitives, so the two look identical and only the storage
 * differs.
 *
 * Every group takes `t` as a prop. There is no locale context on this platform:
 * the server component that resolved the cookie hands the dictionary down, the
 * same way `components/app/place/PlaceFields.tsx` receives it. A client
 * component that reached for the locale itself would resolve it a second time
 * and could disagree with the tree it is rendering inside.
 */

/* ------------------------------------------------------------- appearance */

/**
 * Appearance: text size, data and language. Motion has its own group.
 *
 * THE THEME ROW IS GONE. The founder removed light mode from the platform on
 * 23 September 2026, so there is one palette and nothing for a person to
 * choose; the row, its three options and the store behind them are deleted
 * rather than pinned to Dark, because a control that still has a setter is a
 * control somebody gives a second value back to.
 *
 * Text size scales the root font size, which every rem measure in the app
 * follows. Both settings apply instantly and persist on this device.
 */
export function AppearanceCard({ t, children }: { t: AppearanceCopy; children?: ReactNode }) {
  const { settings, set } = useNfSettings();
  const copy = t.settings.appearance;

  /* Built from the dictionary rather than held as module constants, because a
     module constant is evaluated once per bundle and would freeze whichever
     language happened to load first. */
  const textSizes: { value: TextSize; label: string }[] = [
    { value: "s", label: copy.textSmall },
    { value: "m", label: copy.textMedium },
    { value: "l", label: copy.textLarge },
  ];
  /* The migration is a WRITE to another device's leftover key, so it stays an
     effect: it is this component updating an external system, which is the case
     the rule says an effect is for. */

  /* Follows the two root settings here too, for the preview harness that
     draws this card outside the member layout's ContrastSync. */
  useApplyDeviceSettings();
  const contrastCopy = t.memberKit?.contrast;

  /* MOTION MOVED OUT OF THIS CARD (Track M). The "Reduce motion" switch that
     stood here set a root flag no stylesheet read, so it never did anything;
     the Motion group beside this card (`MotionSettings`) replaced it with four
     levels that do, and it reads the old switch's stored "on" as Calm. */

  return (
    <SettingsGroup label={copy.label} note={copy.note}>
      <RowSelect
        icon="grid"
        label={copy.textSize}
        value={settings.textSize}
        options={textSizes}
        onChange={(next) => set("textSize", next)}
      />
      {/* B15: stronger lines and ink, beside the system's own setting. */}
      {contrastCopy ? (
        <RowSwitch
          icon="contrast"
          label={contrastCopy.label}
          sub={contrastCopy.sub}
          checked={settings.increaseContrast}
          onChange={(next) => set("increaseContrast", next)}
        />
      ) : null}
      {/*
       * The data-saver switch lives beside the other two device settings
       * because it is one: it is stored on the device, it applies to this
       * device, and nothing about it belongs to an account.
       *
       * The description states what it actually does, not "uses less data".
       * Loading a listing before it is asked for is the single largest
       * speculative spend the app makes, and a person on a metered bundle is
       * entitled to know that is what they are switching off. Android's own
       * Data Saver and a 2g link already turn this on by themselves without
       * anybody touching this row; see `lib/ui/data-saver.ts`.
       */}
      <RowSwitch
        icon="compass"
        label={copy.lessData}
        sub={copy.lessDataSub}
        checked={settings.dataSaver}
        onChange={(next) => {
          /* V-79: the cookie the server reads, and this setting, together. */
          setLite(next);
          set("dataSaver", next);
        }}
      />
      {/*
       * LANGUAGE ARRIVES HERE AS A ROW RATHER THAN AS ITS OWN CARD.
       *
       * It was a whole `SettingsGroup` - a labelled glass surface with a note
       * slot and a rounded 22px edge - wrapped around ONE select. A container
       * that holds a single row is a container that has not earned its border,
       * and on a screen that already stacked eleven of them it was the clearest
       * one to lose.
       *
       * It belongs here rather than anywhere else because it is the same KIND
       * of choice as the four rows above it: how the product presents itself,
       * stored on this device, applying to this device, belonging to no
       * account. That is what "Appearance" means on this screen and the file's
       * own header already said language was in that category.
       */}
      {children}
    </SettingsGroup>
  );
}

/* --------------------------------------------------------------- language */

/**
 * Language picker.
 *
 * Writes the locale cookie the server reads, then refreshes the server tree so
 * every string re-renders in the chosen language. One select rather than four
 * radio rows: a language is one answer, and the four rows took a third of the
 * screen to say so.
 */
export function LanguageRow({
  t,
  current,
  label,
  sub,
  glyph,
}: {
  t: LanguageCopy;
  current: Locale;
  /** The settings home names the row "Language" with "App language" under
      it, as the render draws it; the appearance screen keeps the one line. */
  label?: string;
  sub?: ReactNode;
  /** The glass globe, where the calling screen's image draws one. */
  glyph?: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Locale>(current);

  const choose = (next: Locale) => {
    if (next === selected || pending) return;
    setSelected(next);
    // One year, lax. A language choice holds no personal data.
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    /* A11: the choice is also kept on the account (`profiles.settings.locale`),
       so the account and booking emails arrive in it. Signed out, or on a
       failed write, the cookie alone still switches the screen. */
    void updateSettings({ locale: next }).catch(() => undefined);
    startTransition(() => router.refresh());
  };

  return (
      <RowSelect
        {...(glyph ? { glyph } : { icon: "chat-bubble" as const })}
        label={label ?? t.settings.language.appLanguage}
        sub={sub}
        value={selected}
        /* The native name first, because somebody looking for Yoruba is
           looking for "Yorùbá". The English name follows only where the two
           differ, so English itself does not read as "English (English)". */
        options={LOCALES.map((code) => ({
          value: code,
          label:
            localeMeta[code].label === localeMeta[code].native
              ? localeMeta[code].native
              : `${localeMeta[code].native} (${localeMeta[code].label})`,
        }))}
        onChange={choose}
        testId="setting-language"
      />
  );
}

/* ---------------------------------------------------------- notifications */

type NotifyKey = "notifyPush" | "notifyEmail" | "notifySms" | "notifyWhatsapp";

export function NotificationsCard({ t }: { t: NotificationsCardCopy }) {
  const { settings, set } = useNfSettings();
  const copy = t.settings.notifications;

  const row = (key: NotifyKey, icon: "bell" | "share" | "chat-bubble", label: string, sub: string) => (
    <RowSwitch
      icon={icon}
      label={label}
      sub={sub}
      checked={settings[key]}
      onChange={(next) => set(key, next)}
    />
  );

  return (
    <SettingsGroup label={copy.label} note={copy.note}>
      {row("notifyPush", "bell", copy.push, copy.pushSub)}
      {row("notifyEmail", "share", copy.email, copy.emailSub)}
      {row("notifySms", "chat-bubble", copy.sms, copy.smsSub)}
      {row("notifyWhatsapp", "chat-bubble", copy.whatsapp, copy.whatsappSub)}
    </SettingsGroup>
  );
}

/* ---------------------------------------------------------------- privacy */

export function PrivacyCard({ t }: { t: PrivacyCardCopy }) {
  const { settings, set } = useNfSettings();
  const copy = t.settings.privacy;

  return (
    <SettingsGroup label={copy.label} note={copy.note}>
      <RowSwitch
        icon="verified"
        label={copy.readReceipts}
        sub={copy.readReceiptsSub}
        checked={settings.readReceipts}
        onChange={(next) => set("readReceipts", next)}
      />
      <RowSwitch
        icon="house-heart"
        label={copy.personalised}
        sub={copy.personalisedSub}
        checked={settings.personalisedRecs}
        onChange={(next) => set("personalisedRecs", next)}
      />
    </SettingsGroup>
  );
}

/* ----------------------------------------------------------------- search */

export function SearchCard({
  t,
  currencyValue = "₦",
  distanceUnit,
}: {
  t: SearchCardCopy;
  /** The reader's display currency, read on the server ("₦", or "GBP" when a guide is chosen). */
  currencyValue?: string;
  /**
   * The distance unit kept on the account and in a cookie
   * (`lib/currency/preference.ts`), read on the server. Absent, the row falls
   * back to this device's old setting, which nothing else ever read.
   */
  distanceUnit?: DistanceUnit;
}) {
  const { settings, set } = useNfSettings();
  const router = useRouter();
  const [distance, setDistance] = useState<DistanceUnit>(distanceUnit ?? settings.distanceUnit);
  const [servedDistance, setServedDistance] = useState<DistanceUnit | undefined>(distanceUnit);
  if (servedDistance !== distanceUnit) {
    setServedDistance(distanceUnit);
    if (distanceUnit) setDistance(distanceUnit);
  }
  const chooseDistance = (next: DistanceUnit) => {
    if (next === distance) return;
    setDistance(next);
    set("distanceUnit", next);
    /* On the account and in a cookie, so every device and the server agree. */
    void saveDisplayPreferences({ distanceUnit: next })
      .then(() => router.refresh())
      .catch(() => undefined);
  };
  const copy = t.settings.search;

  return (
    <SettingsGroup label={copy.label} note={copy.note}>
      <RowSelect
        icon="search"
        label={copy.defaultArea}
        value={settings.defaultCity}
        /* The 37 state names are proper nouns and stay as they are in every
           language, exactly as the long pickers leave them. */
        options={[
          { value: "", label: copy.allOfNigeria },
          ...NIGERIAN_STATES.map((state) => ({ value: state, label: state })),
        ]}
        onChange={(next) => set("defaultCity", next)}
      />
      {/* R3-16: the currency is chosen on its own screen, where the sheet
          says plainly that payment is always in naira. */}
      <RowLink href="/settings/region#settings-money-display" icon="banknote" label={copy.currency} value={currencyValue} />
      <RowSelect
        icon="map"
        label={copy.mapDistances}
        value={distance}
        options={[
          { value: "km", label: copy.kilometres },
          { value: "mi", label: copy.miles },
        ]}
        onChange={chooseDistance}
      />
    </SettingsGroup>
  );
}

/* --------------------------------------------------------------- security */

/**
 * Security: where this account is signed in. UX-P2-02: the "Biometric app
 * lock" switch saved a preference nothing read (no biometric plugin, no lock
 * screen), and "Sign out everywhere" only showed a note saying this was the
 * only session; both are gone. Ending sessions is real and lives on
 * /settings/devices, reached through the `DevicesRow` passed in as children.
 */
export function SecurityCard({ t, children }: { t: SecurityCardCopy; children?: ReactNode }) {
  const copy = t.settings.security;
  /*
   * DERIVED DURING RENDER, BEHIND THE CLIENT LATCH.
   *
   * This was `useState(copy.thisDevice)` and a mount effect that read
   * `navigator.userAgent` and set the state, which is `set-state-in-effect`
   * again and for the plainest possible reason: the user agent is a constant
   * for the life of the page, so nothing was being synchronised. It was read
   * once, turned into a string, and pushed into React.
   *
   * It cannot simply be computed during render, because `navigator` does not
   * exist while the server renders this row and reading it during hydration
   * would make the client's markup disagree with the server's. `useClientMount`
   * is the latch that says which side we are on, and it is the one
   * `useSyncExternalStore` in the tree whose whole job is that question.
   *
   * Before the latch flips, the row reads "This device", which is true and says
   * nothing it cannot support.
   */
  const onClient = useClientMount();
  const device = onClient ? describeDevice(copy) : copy.thisDevice;

  return (
    <SettingsGroup label={copy.label}>
      <RowValue icon="verified" label={copy.signedInOn} value={device} />
      {/* `DevicesRow` lands here. Where an account is signed in is the half of
          security this screen did not have, and it was a card of its own
          holding one link; see the note on that component. */}
      {children}
      </SettingsGroup>
  );
}

/* ------------------------------------------------------------------- data */

/**
 * Data: a working clear-out that removes every Vallo key from this device and
 * reloads. UX-P2-01: "Download my data" downloaded nothing and said everything
 * Vallo knows lives in this browser, which is false (the account, wallet,
 * bookings and documents are held server-side). It is gone until the real
 * export exists (OPS-12).
 */
export function DataCard({ t }: { t: DataCardCopy }) {
  const copy = t.settings.data;
  const [confirmClear, setConfirmClear] = useState(false);

  const clearLocalData = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    try {
      const doomed: string[] = [];
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith("nf_")) doomed.push(key);
      }
      doomed.forEach((key) => window.localStorage.removeItem(key));
    } catch {
      // Storage unavailable: nothing was held there to begin with.
    }
    window.location.reload();
  };

  return (
    <SettingsGroup label={copy.label}>
      <RowButton
        icon="close"
        label={confirmClear ? copy.clearAgain : copy.clear}
        sub={copy.clearSub}
        onClick={clearLocalData}
        danger={confirmClear}
        chevron={false}
      />
    </SettingsGroup>
  );
}


/**
 * "Chrome on Android", from the user agent, as a person would say it.
 *
 * Lifted out of the component because it is a pure function of a string and a
 * copy bundle, and because a ten-arm nested ternary inside a render body is the
 * kind of thing that gets edited in the wrong arm. Unknown falls back to the
 * copy bundle's own words rather than to the raw user agent, which is not
 * something anybody should be shown on a settings row.
 */
function describeDevice(copy: {
  unknownBrowser: string;
  unknownOs: string;
  deviceOn: string;
}): string {
  const ua = navigator.userAgent;
  const browser = /edg\//i.test(ua)
    ? "Edge"
    : /opr\//i.test(ua)
      ? "Opera"
      : /chrome|crios/i.test(ua)
        ? "Chrome"
        : /firefox|fxios/i.test(ua)
          ? "Firefox"
          : /safari/i.test(ua)
            ? "Safari"
            : copy.unknownBrowser;
  const os = /android/i.test(ua)
    ? "Android"
    : /iphone|ipad|ipod/i.test(ua)
      ? "iOS"
      : /mac os/i.test(ua)
        ? "macOS"
        : /windows/i.test(ua)
          ? "Windows"
          : /linux/i.test(ua)
            ? "Linux"
            : copy.unknownOs;
  return copy.deviceOn.replace("{browser}", browser).replace("{os}", os);
}
