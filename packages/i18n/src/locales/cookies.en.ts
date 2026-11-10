/**
 * THE COOKIE NOTICE AND CHOICE SHEET, in English (founder, 10 November 2026).
 *
 * What the app actually stores is NOT here. The table of every cookie and
 * piece of device storage (name, purpose, type, lifetime) is one source,
 * `apps/web/src/lib/consent/inventory.ts`, and both the cookie page and this
 * sheet's counts read it. This file is only the words around the choice.
 *
 * No dark patterns: the three first-visit buttons carry equal weight and say
 * what they do; "Only necessary" is as easy to reach as "Accept all"; closing
 * the sheet means "Only necessary". No sentence here promises anything the
 * code does not do (lib/trust/claims.ts), and none uses an em dash.
 */
export const cookiesEn = {
  banner: {
    title: "Your cookie choices",
    body: "Vallo uses a few cookies and device storage to work. With your say-so it also remembers small conveniences for you and keeps simple counts of how the product is used. Nothing from the last two is used until you choose.",
    acceptAll: "Accept all",
    onlyNecessary: "Only necessary",
    choose: "Choose",
    policy: "Read the cookie policy",
  },
  sheet: {
    title: "Cookie settings",
    intro: "Pick what Vallo may store on this device. You can change this at any time from Settings or from Cookie settings at the foot of the site.",
    necessaryTitle: "Necessary",
    necessaryBody: "Keeps you signed in, remembers your language and theme, and does what you ask, such as saving a place. Vallo cannot work without these, so they are always on.",
    necessaryAlways: "Always on",
    preferencesTitle: "Preferences",
    preferencesBody: "Remembers conveniences you did not ask for, such as your recent searches and the listings you last looked at.",
    analyticsTitle: "Usage counts",
    analyticsBody: "A random visit number for simple, first-party counts of how people move through sign-up. No third party and no advertising.",
    on: "On",
    off: "Off",
    save: "Save my choices",
    acceptAll: "Accept all",
    onlyNecessary: "Only necessary",
    close: "Close",
    policy: "Read the cookie policy",
  },
  saved: "Your cookie choices are saved.",
  footerLink: "Cookie settings",
  footerPolicy: "Cookies",
  settingsRow: { label: "Cookie settings", sub: "Choose what Vallo may remember on this device" },
} as const;

export type CookiesCopy = typeof cookiesEn;
