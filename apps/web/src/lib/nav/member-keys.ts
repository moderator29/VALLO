/**
 * B17: THE DESKTOP KEYBOARD LAYER, AS A PURE DECISION. Client-safe.
 *
 *   /        focus search (the page's own search field, or go to Search)
 *   g h      Home       g s  Search       g m  Messages       g p  Plans
 *   j / k    next / previous row (inbox rows, search results)
 *   s        save the focused listing
 *   ?        the cheat sheet
 *   Cmd/Ctrl+K   VALLO Intelligence (the one search across Vallo); the
 *            single chord here, and it works from inside a field too
 *
 * Esc is left to each sheet, which already closes on it. Nothing here fires
 * while typing in a field, with a modifier held (so the browser's own
 * shortcuts are untouched), or on a device without a fine pointer.
 */
export type KeyAction =
  | { type: "search" }
  | { type: "intelligence" }
  | { type: "go"; href: string }
  | { type: "move"; dir: 1 | -1 }
  | { type: "save" }
  | { type: "help" }
  | { type: "pending-g" };

export const GO_TARGETS: Readonly<Record<string, string>> = {
  h: "/home",
  s: "/search",
  m: "/messages",
  p: "/bookings",
};

/** How long a "g" waits for its second key. */
export const G_WINDOW_MS = 1200;

export type KeyInput = {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  alt?: boolean;
  /** The event started in a field (input, textarea, select, contenteditable). */
  inField?: boolean;
  /** When the last "g" was pressed, or null. */
  pendingGAt?: number | null;
  now: number;
};

export function decideKey(input: KeyInput): KeyAction | null {
  /* Cmd+K on a Mac, Ctrl+K elsewhere: the one chord, so it is decided before
     the "no modifier" rule below. It works from a field because a search
     launcher is exactly what somebody reaches for from inside a form. */
  if ((input.meta || input.ctrl) && !input.alt && input.key.toLowerCase() === "k") return { type: "intelligence" };
  if (input.inField || input.ctrl || input.meta || input.alt) return null;
  const key = input.key;
  const gOpen = input.pendingGAt != null && input.now - input.pendingGAt <= G_WINDOW_MS;
  if (gOpen) {
    const href = GO_TARGETS[key.toLowerCase()];
    if (href) return { type: "go", href };
  }
  switch (key) {
    case "/":
      return { type: "search" };
    case "?":
      return { type: "help" };
    case "g":
      return { type: "pending-g" };
    case "j":
      return { type: "move", dir: 1 };
    case "k":
      return { type: "move", dir: -1 };
    case "s":
      return { type: "save" };
    default:
      return null;
  }
}

/** The row after (or before) the focused one, clamped to the list. */
export function nextIndex(current: number, dir: 1 | -1, count: number): number {
  if (count <= 0) return -1;
  if (current < 0) return dir === 1 ? 0 : count - 1;
  return Math.max(0, Math.min(count - 1, current + dir));
}

/** The cheat sheet's rows, in order. */
export const KEY_HELP: ReadonlyArray<{ keys: string; what: string }> = [
  { keys: "/", what: "Search" },
  { keys: "Ctrl+K", what: "VALLO Intelligence (Cmd+K on a Mac)" },
  { keys: "g h", what: "Go to Home" },
  { keys: "g s", what: "Go to Search" },
  { keys: "g m", what: "Go to Messages" },
  { keys: "g p", what: "Go to Plans" },
  { keys: "j / k", what: "Next or previous row" },
  { keys: "Enter", what: "Open the row" },
  { keys: "s", what: "Save the listing in focus" },
  { keys: "Esc", what: "Close a sheet" },
  { keys: "?", what: "Show these keys" },
];
