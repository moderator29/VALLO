import type { Dictionary } from "@vallo/i18n/core";

/**
 * A CLIENT COMPONENT GETS THE PART OF THE DICTIONARY IT READS (Track M
 * performance, 25 September 2026).
 *
 * A server page that hands `t` to a `"use client"` component serialises all of
 * it into the page: 365 KB of every surface's words, in the HTML and in the
 * payload of the navigation. A listing card reads three namespaces of it.
 * Each slice below names what one client component (and the children it
 * passes `t` to) reads, and `slice-coverage.test.ts` re-reads those files and
 * fails the build if one starts reading a namespace its slice does not carry.
 *
 * The slices are cached per dictionary object, so thirty cards on a page are
 * handed the SAME object and React sends it once, and a request costs no more
 * than a map lookup. The dictionaries are module constants, so the cache is
 * bounded by the four locales.
 */
const cache = new WeakMap<Dictionary, Map<string, Dictionary>>();

/**
 * A namespace narrowed to some of its own keys: `{ shape: ["card", "cash"] }`
 * hands the component `t.shape.card` and `t.shape.cash` and nothing else of
 * `shape`. Only safe where nothing in the component's graph reads the
 * namespace as a whole, which `slice-coverage.test.ts` checks key by key.
 */
export type Narrow = Readonly<Partial<Record<keyof Dictionary, readonly string[]>>>;

export function sliceDictionary(t: Dictionary, keys: readonly (keyof Dictionary)[], narrow: Narrow = {}): Dictionary {
  const id = `${keys.join(",")}|${Object.entries(narrow)
    .map(([ns, sub]) => `${ns}:${(sub ?? []).join("+")}`)
    .join(",")}`;
  let byKeys = cache.get(t);
  if (!byKeys) {
    byKeys = new Map();
    cache.set(t, byKeys);
  }
  let slice = byKeys.get(id);
  if (!slice) {
    slice = Object.fromEntries(
      keys.map((key) => {
        const only = narrow[key];
        const whole = t[key] as unknown as Record<string, unknown>;
        return [key, only ? Object.fromEntries(only.map((name) => [name, whole[name]])) : whole];
      }),
    ) as unknown as Dictionary;
    byKeys.set(id, slice);
  }
  return slice;
}

export const SLICES = {
  /* Each list is what the component's WHOLE import graph can read, as the
     coverage test computes it. The walker skips what cannot read a
     dictionary in the browser (server actions, whole-line comments, the
     Supabase `auth` client, the root layout's client copy, `Dictionary[...]`
     types) and otherwise over-counts on purpose: one namespace too many is a
     few kilobytes, one too few is a crash in somebody's hand. Trimming those
     false readings took the settings screen's slice from 137 KB to 47 KB and
     the listing card's from 104 KB to 55 KB. */
  listingCard: ["catalogue", "common", "directHome", "experienceLabels", "homeV2", "interests", "moveIn", "shape", "trustVisible", "units"],
  stayCard: ["catalogue", "common", "stays", "restaurantPage"],
  stayFilterSheet: ["catalogue", "shape", "stayDetail", "stays"],
  priceCheck: ["home", "priceCheck"],
  proofStrip: ["trustVisible"],
  settingsHub: ["common", "directHome", "experienceSettings", "interests", "memberKit", "passcode", "paymentsPage", "platform", "publicDoors", "settings", "socialProfile", "units"],
  emailAuthForm: ["auth", "authFlow", "common", "publicDoors", "safety", "signUp", "welcomeCards"],
  codeSignInForm: ["auth", "authFlow", "publicDoors", "signUp"],
  verifyCodeForm: ["auth", "authFlow", "signUp"],
  finishSetupForm: ["auth", "safety", "signUp"],
  forgotPasswordForm: ["auth", "common", "signUp"],
  resetCodeForm: ["auth", "authFlow", "signUp"],
  resetPasswordForm: ["auth", "authFlow", "signUp"],
  signUpOptions: ["auth", "common", "landing", "publicDoors", "side", "stays"],
  welcomeFlow: ["auth", "common", "interests", "landing", "moveIn", "onboardingMotion", "pickers", "platform", "shape", "side", "signUp", "stays", "success", "welcomeCards"],
  interestChoices: ["common", "interests", "platform"],
  stayStackCard: ["catalogue", "restaurantPage", "stays"],
  accountToggles: ["settings", "shape"],
  agentNav: ["a11y", "agent"],
} as const satisfies Record<string, readonly (keyof Dictionary)[]>;

/*
 * THE SECOND LEVEL (Session 3, R2). `shape` is 5.5 KB gzipped and
 * `trustVisible` 7.3 KB, and a card reads six keys of the first and one of the
 * second, so carrying them whole put 9 KB of other screens' words in every
 * page of cards (search, home, saved, the shelf). The coverage test walks the
 * same import graph and fails if anything reaches a key not listed here, or
 * starts reading either namespace as a whole.
 */
export const NARROW = {
  listingCard: {
    /* The rent line's "/yr" (C9). */
    experienceLabels: ["periodShort"],
    /* The space card's "from" and its photo gallery's name. */
    homeV2: ["photoOf", "priceFrom"],
    shape: ["card", "cash", "compound", "listed", "service", "unit"],
    trustVisible: ["proof"],
  },
  proofStrip: { trustVisible: ["proof"] },
  welcomeFlow: {
    shape: ["wall"],
    signUp: ["hearAbout"],
  },
  interestChoices: { platform: ["lite"] },
} as const satisfies Record<string, Narrow>;

export function forListingCard(t: Dictionary): Dictionary {
  return sliceDictionary(t, SLICES.listingCard, NARROW.listingCard);
}
export function forStayCard(t: Dictionary): Dictionary {
  return sliceDictionary(t, SLICES.stayCard);
}
export function forStayFilterSheet(t: Dictionary): Dictionary {
  return sliceDictionary(t, SLICES.stayFilterSheet);
}
export function forPriceCheck(t: Dictionary): Dictionary {
  return sliceDictionary(t, SLICES.priceCheck);
}
export function forProofStrip(t: Dictionary): Dictionary {
  return sliceDictionary(t, SLICES.proofStrip, NARROW.proofStrip);
}
export function forSettingsHub(t: Dictionary): Dictionary {
  return sliceDictionary(t, SLICES.settingsHub);
}
export function forEmailAuthForm(t: Dictionary): Dictionary {
  return sliceDictionary(t, SLICES.emailAuthForm);
}
export function forCodeSignInForm(t: Dictionary): Dictionary {
  return sliceDictionary(t, SLICES.codeSignInForm);
}
export function forVerifyCodeForm(t: Dictionary): Dictionary {
  return sliceDictionary(t, SLICES.verifyCodeForm);
}
export function forFinishSetupForm(t: Dictionary): Dictionary {
  return sliceDictionary(t, SLICES.finishSetupForm);
}
export function forForgotPasswordForm(t: Dictionary): Dictionary {
  return sliceDictionary(t, SLICES.forgotPasswordForm);
}
export function forResetCodeForm(t: Dictionary): Dictionary {
  return sliceDictionary(t, SLICES.resetCodeForm);
}
export function forResetPasswordForm(t: Dictionary): Dictionary {
  return sliceDictionary(t, SLICES.resetPasswordForm);
}
export function forSignUpOptions(t: Dictionary): Dictionary {
  return sliceDictionary(t, SLICES.signUpOptions);
}
export function forWelcomeFlow(t: Dictionary): Dictionary {
  return sliceDictionary(t, SLICES.welcomeFlow, NARROW.welcomeFlow);
}
export function forInterestChoices(t: Dictionary): Dictionary {
  return sliceDictionary(t, SLICES.interestChoices, NARROW.interestChoices);
}
export function forStayStackCard(t: Dictionary): Dictionary {
  return sliceDictionary(t, SLICES.stayStackCard);
}
export function forAccountToggles(t: Dictionary): Dictionary {
  return sliceDictionary(t, SLICES.accountToggles);
}
export function forAgentNav(t: Dictionary): Dictionary {
  return sliceDictionary(t, SLICES.agentNav);
}
