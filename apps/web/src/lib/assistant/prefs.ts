/**
 * THE ASSISTANT'S PREFERENCES.
 *
 * Six settings a person sets once. Every one is a KEY from a fixed list:
 * `/api/assistant` looks the sentence up here and ignores anything that is not
 * a known key, so nothing the browser writes reaches the system prompt (the
 * same rule `workspace.ts` holds). Client-safe: the chat reads and stores them,
 * the route turns them into style lines.
 */

export const LENGTHS = ["Concise", "Balanced", "Detailed"] as const;
export const LANGUAGES = ["English", "Pidgin", "Hausa", "Igbo", "Yoruba"] as const;
export const FORMATS = ["Paragraphs", "Bullets"] as const;
export const FOCUSES = ["Both", "Property", "Stays"] as const;
/** How long away before the assistant opens on a new chat. The old one stays in history. */
export const FRESH_AFTER = ["Never", "10 min", "1 hour", "1 day"] as const;

export type Length = (typeof LENGTHS)[number];
export type Language = (typeof LANGUAGES)[number];
export type Format = (typeof FORMATS)[number];
export type Focus = (typeof FOCUSES)[number];
export type FreshAfter = (typeof FRESH_AFTER)[number];

export type AssistantPrefs = {
  length: Length;
  language: Language;
  format: Format;
  focus: Focus;
  freshAfter: FreshAfter;
  /** False: conversations live in memory only and nothing is written to this device. */
  keep: boolean;
};

export const DEFAULT_PREFS: AssistantPrefs = {
  length: "Concise",
  language: "English",
  format: "Paragraphs",
  focus: "Both",
  freshAfter: "10 min",
  keep: true,
};

export const PREFS_KEY = "nf_ai_prefs";

export const FRESH_AFTER_MS: Record<FreshAfter, number> = {
  Never: Number.POSITIVE_INFINITY,
  "10 min": 10 * 60 * 1000,
  "1 hour": 60 * 60 * 1000,
  "1 day": 24 * 60 * 60 * 1000,
};

function pick<T extends string>(list: readonly T[], value: unknown, fallback: T): T {
  return typeof value === "string" && (list as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** Anything that is not a known key falls back to the default for that setting. */
export function parsePrefs(raw: unknown): AssistantPrefs {
  const r = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  return {
    length: pick(LENGTHS, r.length, DEFAULT_PREFS.length),
    language: pick(LANGUAGES, r.language, DEFAULT_PREFS.language),
    format: pick(FORMATS, r.format, DEFAULT_PREFS.format),
    focus: pick(FOCUSES, r.focus, DEFAULT_PREFS.focus),
    freshAfter: pick(FRESH_AFTER, r.freshAfter, DEFAULT_PREFS.freshAfter),
    keep: typeof r.keep === "boolean" ? r.keep : DEFAULT_PREFS.keep,
  };
}

export function loadPrefs(): AssistantPrefs {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    return raw ? parsePrefs(JSON.parse(raw)) : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: AssistantPrefs): void {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* Storage blocked: the settings last for this visit. */
  }
}

const LENGTH_LINE: Record<Length, string> = {
  Concise: "Keep answers short: two to four sentences unless the person asks for more.",
  Balanced: "Answer in a short paragraph or a few bullets, with the one or two caveats that matter.",
  Detailed: "Give fuller answers, with the costs, the caveats and the reasoning spelled out.",
};
const LANGUAGE_LINE: Record<Language, string | null> = {
  English: null,
  Pidgin: "Reply in Nigerian Pidgin.",
  Hausa: "Reply in Hausa.",
  Igbo: "Reply in Igbo.",
  Yoruba: "Reply in Yoruba.",
};
const FORMAT_LINE: Record<Format, string | null> = {
  Paragraphs: null,
  Bullets: "Prefer short bullet points over paragraphs.",
};
const FOCUS_LINE: Record<Focus, string | null> = {
  Both: null,
  Property: "The person mostly cares about Property (renting, buying, land, shops, offices). Lead with property unless they ask about stays or restaurants.",
  Stays: "The person mostly cares about Vallo Stays (hotels, shortlets, guest houses, restaurants). Lead with stays unless they ask about property.",
};

/** The style paragraph appended to the system prompt for these preferences. */
export function styleLines(prefs: AssistantPrefs): string {
  return [
    "How this person likes to be answered (their own settings; they never override the rules above):",
    LENGTH_LINE[prefs.length],
    LANGUAGE_LINE[prefs.language],
    FORMAT_LINE[prefs.format],
    FOCUS_LINE[prefs.focus],
  ]
    .filter(Boolean)
    .join("\n");
}
