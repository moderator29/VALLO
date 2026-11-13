import { LOCALES, getDictionary, type Dictionary } from "@vallo/i18n";
import { CURRENCY_META, DISPLAY_CURRENCIES } from "@/lib/currency/currencies";

/**
 * A WAY TO FIND, ON A SETTINGS HOME THAT IS NOW A HUB.
 *
 * The search is a plain GET, not a client filter. The answer belongs in the
 * address: a narrowed settings screen is then a link somebody can send to the
 * person they are helping over the phone, the back button walks the narrowing
 * backwards, a reload lands on the same rows, and it costs no JavaScript to
 * type on a connection where a bundle is the difference between working and
 * waiting.
 *
 * The index is built out of the dictionary blocks the screens render from, so
 * there is no second copy of any label to go stale: somebody searching
 * "Hausa" lands on the screen that actually holds the language control.
 *
 * Each match is a LINK to the screen that holds the setting, because the home
 * no longer holds them all: the hub rows lead to `/settings/account`,
 * `/settings/notifications`, `/settings/privacy`, `/settings/appearance` and
 * `/settings/help`, and a search result goes where the row goes.
 */

/** SW11: source of truth is now `packages/i18n/src/locales/settings-search.en.ts`. */
export const SETTINGS_SEARCH_COPY = getDictionary("en").settingsSearch;

export type SettingsSection = {
  id: string;
  label: string;
  /** The screen that holds the control, with the section's anchor on it. */
  href: string;
  haystack: string;
};

export function flattenTerms(block: unknown, depth = 0): string {
  if (typeof block === "string") return block;
  if (depth > 4 || block === null || typeof block !== "object") return "";
  return Object.values(block as Record<string, unknown>)
    .map((value) => flattenTerms(value, depth + 1))
    .filter((value) => value.length > 0)
    .join(" ");
}

function section(id: string, href: string, label: string, ...blocks: unknown[]): SettingsSection {
  return {
    id,
    label,
    href,
    /* The label is indexed too, so a word that only appears in the name of
       a section finds the section even when no row inside it matches. */
    haystack: [label, ...blocks.map((block) => flattenTerms(block))].join(" ").toLowerCase(),
  };
}

/* The four languages by their own names, so "Hausa" typed by a Hausa speaker
   lands on the appearance screen whatever language the app is showing. */
const LANGUAGE_NAMES = Object.fromEntries(
  LOCALES.map((locale) => [locale, getDictionary(locale).meta.localeNativeName]),
) as Record<string, string>;

export function settingsSections(t: Dictionary): SettingsSection[] {
  return [
    section(
      "settings-appearance",
      "/settings/appearance#settings-appearance",
      t.settings.appearance.label,
      t.settings.appearance,
      t.settings.language,
      LANGUAGE_NAMES,
    ),
    section(
      "settings-place",
      "/settings/account#settings-place",
      t.settings.place.label,
      t.settings.place,
      t.interests,
    ),
    section(
      "settings-notifications",
      "/settings/notifications#settings-notifications",
      t.settings.notifications.label,
      t.settings.notifications,
      t.settings.notify,
    ),
    section("settings-privacy", "/settings/privacy#settings-privacy", t.settings.privacy.label, t.settings.privacy),
    section("settings-search", "/settings/account#settings-search", t.settings.search.label, t.settings.search),
    /* Currency and floor area (13 November 2026): the guide currency beside
       naira prices, and square metres or square feet. The currency names are
       indexed so "pounds" or "cedi" finds the control. */
    section(
      "settings-currency",
      "/settings/region#settings-money-display",
      t.experienceSettings.preferences.currency,
      t.experienceSettings.preferences,
      DISPLAY_CURRENCIES.map((code) => `${code} ${CURRENCY_META[code].name} ${CURRENCY_META[code].spoken}`).join(" "),
      "exchange rate dollars pounds square feet metres floor area",
    ),
    section(
      "settings-security",
      "/settings/privacy#settings-security",
      t.settings.security.label,
      t.settings.security,
      t.settings.devices,
    ),
    section(
      "settings-ai-consent",
      "/settings/privacy/ai",
      t.settings.aiConsent.label,
      t.settings.aiConsent,
      "ai assistant anthropic consent withdraw",
    ),
    section("settings-data", "/settings/privacy/data", t.settings.data.label, t.settings.data),
    section(
      "settings-account",
      "/settings/account#settings-account",
      t.settings.account.label,
      t.settings.account,
      t.settings.delete,
    ),
    section("settings-payments", "/settings/payments", t.paymentsPage.title, t.paymentsPage),
    section(
      "settings-help",
      "/settings/help#settings-help",
      t.settings.about.help,
      "help support assistant contact us ticket",
    ),
    section("settings-about", "/settings/help#settings-about", t.settings.about.label, t.settings.about),
  ];
}

export function matchSettings(sections: SettingsSection[], query: string): SettingsSection[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 0) return sections;
  return sections.filter((entry) => words.every((word) => entry.haystack.includes(word)));
}
