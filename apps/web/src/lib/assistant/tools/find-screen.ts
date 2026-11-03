import { z } from "zod";
import { screenName } from "@/lib/nav/route-labels";
import { ROUTE_PARENTS } from "@/lib/nav/route-parents";
import { isKnownRoute } from "@/lib/routing/known-routes";
import { defineTool, TOOL_FRAMES, type ToolFrame } from "./types";

/**
 * "WHERE DO I FIND..." FROM THE APP'S OWN LIST OF SCREENS (AI-05).
 *
 * The model used to answer navigation questions from paths typed into its
 * prompt, which is how an assistant names a screen that does not exist. This
 * tool answers from the route registry instead: every screen declared in
 * `lib/nav/route-parents.ts` that `lib/nav/route-labels.ts` gives a name, kept
 * only when
 *
 *   - `isKnownRoute` answers true for it;
 *   - it has no dynamic segment (`[id]`), since a path with a hole in it is
 *     not somewhere a person can be sent;
 *   - it is not under `/admin` (or the dev-only previews, or an alias that
 *     only redirects); and
 *   - it belongs to the frame the assistant was opened in: the agent
 *     workspace sees `/agent` screens, the host workspace `/host` screens,
 *     and the plain concierge every member screen outside the workspaces.
 *
 * The words that help a need find a screen ("viewing times" finding
 * Inspections) are model-facing hints kept here, not interface copy.
 */

/** First segments never offered, whatever the frame. */
const NEVER_OFFERED = new Set(["admin", "api", "preview", "styleguide", "home-or-landing", "first-run"]);

/** Extra words a person might use for a screen, beyond its name and path. */
const HINTS: Readonly<Record<string, string>> = {
  "/agent/dashboard": "dashboard overview today summary home workspace",
  "/agent/listings": "listing listings property properties manage edit photos price prices advert",
  "/agent/inspections": "inspection inspections viewing viewings visit visits window windows time times slot slots schedule availability route day",
  "/agent/bookings": "booking bookings stay stays guest guests reservation",
  "/agent/messages": "message messages chat chats enquiry enquiries inbox reply lead leads",
  "/agent/earnings": "earning earnings payout payouts paid pay money bank income",
  "/agent/verification": "verification verify ladder identity document documents badge",
  "/agent/settings": "setting settings account preferences contact",
  "/agent/analytics": "analytics views figures performance stats statistics",
  "/agent/promotion": "promote promotion boost advertise",
  "/agent/reviews": "review reviews rating ratings",
  "/agent/portfolio": "portfolio building buildings unit units vacant let landlord tenant tenants",
  "/agent/firm": "firm agency team colleague colleagues",
  "/agent/notifications": "notification notifications alert alerts",
  "/agent/assistant": "assistant concierge ask",
  "/host": "overview today workspace dashboard summary",
  "/host/reservations": "reservation reservations table tables restaurant diner diners cover covers",
  "/host/bookings": "booking bookings room guest guests arrival arrivals stay stays",
  "/host/rooms": "room rooms night nights availability rate rates unit units",
  "/host/calendar": "calendar date dates night nights block open availability",
  "/host/photos": "photo photos photograph photographs picture pictures image images gallery",
  "/host/arrival": "arrival door charge charges check-in directions",
  "/host/earnings": "earning earnings payout payouts money bank income",
  "/host/decide": "decide request requests respond accept decline deadline",
  "/host/reviews": "review reviews rating ratings",
  "/host/settings": "setting settings account business",
  "/host/notifications": "notification notifications alert alerts",
  "/search": "search find rent buy property flat flats house houses apartment land shop office",
  "/stays": "stay stays hotel hotels shortlet shortlets guest house",
  "/restaurants": "restaurant restaurants table tables eat dinner",
  "/bookings": "plans plan booking bookings trip trips viewing viewings inspection inspections",
  "/messages": "message messages chat chats inbox",
  "/agreements": "agreement agreements tenancy contract rent pay",
  "/saved": "saved save favourite favourites wishlist",
  "/payments": "payment payments paid",
  "/receipts": "receipt receipts",
  "/refunds": "refund refunds",
  "/notifications": "notification notifications alert alerts",
  "/support": "help support ticket complaint contact",
  "/settings": "setting settings account preferences",
  "/settings/privacy/ai": "assistant ai agreement consent",
  "/settings/ai-assistant": "assistant ai personal permissions turn on off settings",
};

const STOP_WORDS = new Set(
  "a an and are at be can do does find for from get go how i in is it me my of on or page screen see set show the there to up vallo want what where which who why with you your app change open".split(
    " ",
  ),
);

/** Lowercase words, light plural folding, stop words out. */
function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
    .map((w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w));
}

export type Screen = { href: string; label: string };

function frameOf(href: string): ToolFrame | "admin" {
  const first = href.split("/").filter(Boolean)[0];
  if (first === "agent") return "agent";
  if (first === "host") return "host";
  if (first === "admin") return "admin";
  return "consumer";
}

/**
 * Every screen this tool may ever name in `frame`, from the registry, in
 * registry order. Pure; tests walk it.
 */
export function screensFor(frame: ToolFrame): Screen[] {
  const out: Screen[] = [];
  for (const href of Object.keys(ROUTE_PARENTS)) {
    if (href.includes("[")) continue;
    const first = href.split("/").filter(Boolean)[0];
    if (first !== undefined && NEVER_OFFERED.has(first)) continue;
    if (!isKnownRoute(href)) continue;
    if (frameOf(href) !== frame) continue;
    const label = screenName(href);
    if (!label) continue;
    out.push({ href, label });
  }
  return out;
}

export const MAX_SCREENS = 5;

/** Up to five screens in `frame` that fit `need`, best first. */
export function findScreens(need: string, frame: ToolFrame): Screen[] {
  const wanted = new Set(words(need));
  if (wanted.size === 0) return [];
  const scored = screensFor(frame)
    .map((screen, order) => {
      const bag = new Set(words(`${screen.label} ${screen.href} ${HINTS[screen.href] ?? ""}`));
      let score = 0;
      for (const w of wanted) if (bag.has(w)) score += 1;
      return { screen, score, depth: screen.href.split("/").length, order };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.depth - b.depth || a.order - b.order);
  return scored.slice(0, MAX_SCREENS).map((s) => s.screen);
}

export const NO_SCREEN_NOTE =
  "No screen matched. Say you are not sure where that is rather than guessing a path, and never build a path yourself.";

export const findScreenTool = defineTool({
  name: "find_screen",
  description:
    "Find where something is in the Vallo app. Pass what the person wants to do or find, in their words. Returns up to five real screens, each with its href and name, taken from the app's own list of screens for the workspace they are asking from. Use this whenever somebody asks where to find or do something in the app, and point them only at an href this returns or one named in your instructions; never build a path yourself.",
  input: z.object({
    need: z.string().trim().min(1).max(300),
  }),
  inputSchema: {
    type: "object",
    properties: {
      need: {
        type: "string",
        description: "What the person wants to find or do, e.g. set my viewing times, see my payouts.",
      },
    },
    required: ["need"],
    additionalProperties: false,
  },
  mode: "read",
  workspaces: TOOL_FRAMES,
  async run(ctx, args) {
    const screens = findScreens(args.need, ctx.frame);
    return screens.length > 0 ? { data: { screens } } : { data: { screens: [] }, note: NO_SCREEN_NOTE };
  },
});
