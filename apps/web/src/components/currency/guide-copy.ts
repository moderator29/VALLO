/**
 * The guide copy, as plain data and a plain function, so both the server
 * (GuideScope) and the client (DisplayMoneyProvider, Price) can use it.
 */

/** The words round a guide figure (`experienceSettings.preferences`). */
export type GuideCopy = {
  /** "about {amount}" */
  about: string;
  /** "less than {amount}" */
  under: string;
  /** "approximately {amount}, as a guide. You pay in naira." */
  aboutSpoken: string;
  /** "sq ft", for a floor area in the reader's unit. */
  sqftShort?: string;
  /** "mi", for a distance in the reader's unit. */
  miShort?: string;
};

/** The guide copy out of a dictionary's preferences block. */
export function guideCopyOf(preferences: GuideCopy): GuideCopy {
  return {
    about: preferences.about,
    under: preferences.under,
    aboutSpoken: preferences.aboutSpoken,
    ...(preferences.sqftShort ? { sqftShort: preferences.sqftShort } : {}),
    ...(preferences.miShort ? { miShort: preferences.miShort } : {}),
  };
}
