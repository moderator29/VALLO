/**
 * The 35 store images, by DESIGN.md section 6a and the round-2 review
 * (30 September 2026), redrawn on 14 October 2026 against that afternoon's
 * recapture of the live app (the n-, f- and sc- captures the October films
 * use), in the manner of X's App Store set:
 *
 *   - one night ground for every image, a vertical gradient from #050B3D
 *     (the top row) to #010118 (the last), drawn by compose.mjs;
 *   - the headline, centred at the top on the same baselines in every image,
 *     set on its ink, never wider than the phone plus 50 px;
 *   - the phone: big, centred on its screen, whole, straight on, the same
 *     size in every image, lit so its frame reads against the ground, with
 *     the capture laid on flat (the app's dark theme).
 *
 * Nothing else is drawn, except on two images, each with one card that has
 * just arrived: "Room booked" (4) and "Payment settled" (13). Both follow one
 * rule: the card overhangs one edge of the phone by 70 to 90 px, never sits
 * on a button or words (it covers the app's header whole, as a notification
 * does), carries the Example chip, and sets any amount in white.
 *
 * One pair shares one big tilted phone across its seam, as X's "Be the
 * first to know" does: 4 and 5, the stays home.
 *
 * Order: the first three, then a pair in the first swipe; never more than
 * two screens without a photograph or artwork in a row; screens that look
 * alike at store size (the three home rows, the two searches, the two stay
 * pages, the two cost pages) far apart.
 */
import { headline } from "../components.mjs";
import { furnish, panelFor } from "../furniture.mjs";
import { lineCallout } from "../callouts.mjs";
import { FURNITURE } from "./furniture/index.mjs";
import { brandUrl } from "../lib.mjs";

/* ------------------------------------------------------------- the system */

/** The ground (compose.mjs draws it): the first row and the last. */
export const GROUND = { top: [5, 11, 61], bottom: [1, 1, 24] };
const PHONE_COLOR = "black-titanium";
const FRONT = { rotation: { x: 0, y: 0, z: 0 }, fov: 20 };

/**
 * The grid every image shares, per store (page pixels). The headline's cap
 * height is 2.7% of the image's height in both stores (112 px on 2868, 100 px
 * on 2560), so the two sets read the same size in their store rows; `max` is
 * the phone's width plus 50 px.
 */
export function M(ctx) {
  const { W, H, ios } = ctx;
  const size = ios ? 112 : 100;
  const hlTop = ios ? 140 : 130;
  /* 16 October. The handset came down about a tenth so the pop-outs have a
     margin to stand in, and the band under it is deep enough that a card
     there covers the bottom bar and nothing else. That is how the blueprint's
     layering works, and how a card stops having to sit on the screen's own
     sentences.
     The headline's measure is unchanged, so the set reads at the same size. */
  const phoneTop = ios ? 560 : 520;
  const phoneBottom = ios ? 300 : 280;
  return {
    W, H, size, hlTop, lh: 1.08,
    side: ios ? 80 : 88,
    /* the phone's frame is 1080 px wide on the App Store and 946 on Play */
    max: ios ? 1130 : 996,
    subSize: ios ? 30 : 34,
    phoneTop,
    phoneH: H - phoneTop - phoneBottom,
    /* how far a card overhangs the phone's edge, in px (and still keeps 40 px to the
       image's edge), and how far the frame's outer edge lies outside the display, in
       display px (2.35 mm on the island, 1.95 mm on the Android) */
    overhang: ios ? 50 : 80,
    frame: ios ? 42 : 36,
    /* the cards keep the same size against the phone in both stores (the Play
       phone is 0.876 of the App Store's width) */
    card: 1.3 * (ios ? 1 : 0.876),
  };
}

function head(ctx, m, lines, { align = "center", sub, keyStyle } = {}) {
  return headline({
    lines, cx: ctx.W / 2, x: m.side, y: m.hlTop, max: m.max, size: m.size, align, weight: 600, lineHeight: m.lh, keyStyle,
    sub, subSize: m.subSize, subGap: m.subSize * (ctx.ios ? 0.5 : 0.42), subColor: "rgb(255 255 255 / 0.6)",
  });
}

/**
 * The phone every plain image shows: straight on, centred on its screen
 * (the side buttons make the body's box lopsided), with the display's corner
 * on whole pixels so the flat layer lands exactly.
 */
async function stdPhone(ctx, m, id) {
  const cy = m.phoneTop + m.phoneH / 2;
  const opts = { id, h: m.phoneH, rotation: FRONT.rotation, fov: FRONT.fov, color: PHONE_COLOR, flat: true };
  const first = await ctx.phone({ ...opts, cx: ctx.W / 2, cy });
  const sx = first.quad.reduce((a, q) => a + q[0], 0) / 4;
  let dx = ctx.W / 2 - sx;
  const tl = first.quad[0];
  dx += Math.round(tl[0] + dx) - (tl[0] + dx);
  const dy = Math.round(tl[1]) - tl[1];
  if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return withDisplay(ctx, first);
  ctx.placed.pop();
  ctx.flats.pop();
  return withDisplay(ctx, await ctx.phone({ ...opts, cx: ctx.W / 2 + dx, cy: cy + dy }));
}

/** The display file the handset is showing, so `magnify` can draw from it. */
function withDisplay(ctx, p) {
  const flat = ctx.flats[ctx.flats.length - 1];
  if (flat) p.displayUrl = `file://${flat.file}`;
  return p;
}

/**
 * The template every plain image follows. `pops`, `props` and `figures` are
 * the 16 October pop-out furniture (furniture.mjs): the containers with the
 * tick edges, the brand's 3D objects and the oversized outlined numbers.
 */
export function std(n, slug, id, lines, { sub, extra, ...rest } = {}) {
  const spec = { ...(FURNITURE[n] || {}), ...rest };
  return {
    n, slug, captures: [id],
    async layout(ctx) {
      const m = M(ctx);
      const p = await stdPhone(ctx, m, id);
      const { pops, props, figures, badges, mags, panel = true } = spec;
      const furniture = furnish(ctx, m, p, { pops, props, figures, badges, mags });
      return [panel ? panelFor(ctx, m) : "", head(ctx, m, lines, { sub, keyStyle: spec.keyStyle }), p.html, furniture, extra ? await extra(ctx, m, p) : ""].join("\n");
    },
  };
}

/* ------------------------------------------------------------- the cards */

/* Page positions on a placed phone's display (display px, 1320 x 2868). */
const HEADER = { top: 186, bottom: 365, bell: { x: 1204, y: 275, r: 66 }, menu: [77, 126], logo: [234, 596] };
/* Boxes on the display (display px): the camera cut-out of each handset (measured on
   the studio's white display), the header's menu glyph, and host-start's title. */
const CAMERA = { island: [472, 34, 848, 145], android: [632, 20, 688, 75] };
const MENU = [77, 256, 126, 295];
/* f-host-start (14 October), from the top: the back button and the step bar sit at display
   y 490 to 660, and the title "Add a workspace" runs from 727 to 976 */
const BACK = [30, 490, 400, 660];
const TITLE = [48, 727, 830, 976];
/** A display box mapped onto the page through a placed phone's `at()`, less `dx`. */
function pageBox(at, [x0, y0, x1, y1], label, dx = 0) {
  const pts = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => at(x, y));
  return { x: Math.min(...pts.map((p) => p[0])) - dx, r: Math.max(...pts.map((p) => p[0])) - dx, y: Math.min(...pts.map((p) => p[1])), b: Math.max(...pts.map((p) => p[1])), label };
}

/* ------------------------------------------------------------- the pairs */

/**
 * Two neighbours that share one phone across their seam. Each keeps its own
 * headline, set left on the same grid, so the words run on across the seam;
 * the phone is drawn once, tilted by the 3D studio, and keeps the studio's
 * own mapping of the capture.
 */
export function pair(a, b, { id, rotation, fov, dx = 0, h = 1, clear, through, extraA, extraB }) {
  const shared = async ({ pc, W, H, ios }) => {
    const m = M({ W, H, ios });
    const o = { id, cy: m.phoneTop + m.phoneH / 2, h: m.phoneH * h, rotation, fov, color: PHONE_COLOR, margin: ios ? 64 : 70 };
    let p = await pc.phone({ ...o, cx: W + dx * (W / 1320) });
    if (clear || through) {
      /* Slide the phone so the seam passes `clear.gap` px to the right of a
         region of the display (display px), such as a name; or exactly
         through a point of the display, such as the space between two words. */
      let shift;
      if (through) shift = W - p.at(through[0], through[1])[0];
      else {
        const [x0, y0, x1, y1] = clear.box;
        const right = Math.max(...[[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => p.at(x, y)[0]));
        shift = W - clear.gap * (W / 1320) - right;
      }
      pc.placed.pop();
      p = await pc.phone({ ...o, cx: W + dx * (W / 1320) + shift });
    }
    return { html: p.html, phone: p };
  };
  /* A pair's halves draw their own panel, furniture and headline: `pair`
     builds them itself rather than through `std`, so without this nothing in
     shots/furniture/ could ever reach them. `mags` cannot: the shared phone
     is tilted, not flat, so there is no display layer to magnify. */
  const words = (S, extra) => async (ctx) => {
    const m = M(ctx);
    const spec = FURNITURE[S.n] || {};
    const furniture = furnish(ctx, m, null, { props: spec.props, badges: spec.badges, figures: spec.figures });
    return [panelFor(ctx, m), head(ctx, m, S.lines, { align: "left", keyStyle: spec.keyStyle }), furniture, extra ? await extra(ctx, m) : ""].join("\n");
  };
  return [
    { n: a.n, slug: a.slug, captures: [id], pairWith: b.n, shared, layout: words(a, extraA) },
    { n: b.n, slug: b.slug, captures: [id], pairedFrom: a.n, layout: words(b, extraB) },
  ];
}

/* ------------------------------------------------------------- the 35 */

export const SHOTS = [
  std(1, "find-your-next-home-in-nigeria", "n-home", ["Find your next *home*", "in Nigeria"], { keyStyle: "chip" }),
  /* 2: the listing itself, whose move-in total sits under the photograph.
     Both figures are the ones the screen under them prints: ₦18m a year on
     the listing, ₦26.1m in the bar at the foot. */
  std(2, "the-move-in-total-before-you-call", "n-listing", ["The move-in total,", "before you call"]),
  /* 3: the cost page, whose own summary row this card repeats at size. */
  std(3, "every-fee-added-up", "sc-listing-cost", ["Every fee,", "added up"]),

  /* 4 and 5, the one connected pair: the stays home across the seam, leaning
     right, slid so the seam passes clear of every word. The booking arrives
     on 4, over the phone's left edge beside the header (clear of the menu),
     where the ground is open; on 5 the phone's right side has no room for a
     card of this size within the overhang rule. */
  ...pair(
    { n: 4, slug: "hotels-shortlets-and-restaurants", lines: ["Hotels, shortlets", "and restaurants"] },
    { n: 5, slug: "book-a-room-in-a-few-taps", lines: ["Book a room", "in a few taps"] },
    {
      id: "n-stays", rotation: { x: -16, y: -16, z: -17 }, fov: 26, h: 1, through: [893, 1272],
      async extraA(ctx, m) {
        const { W, ios } = ctx;
        const sp = ctx.shared.phone;
        /* (04 is the pair's left half, so the shared phone's page x is this image's x) */
        /* the frame's left rim, as page x at page y (sampled along the display's left edge) */
        const rim = Array.from({ length: 60 }, (_, k) => sp.at(-m.frame, (k * 2868) / 59));
        const rimX = (y) => {
          for (let k = 1; k < rim.length; k += 1) {
            const [xa, ya] = rim[k - 1]; const [xb, yb] = rim[k];
            if ((y - ya) * (y - yb) <= 0) return xa + ((xb - xa) * (y - ya)) / (yb - ya || 1);
          }
          return rim[0][0];
        };
        const [, midY] = sp.at(0, 275);
        /* The card sits level with the header's middle, and is lowered (where the rim
           lies further left) only as far as it takes to reach 20 px over the rim while
           keeping clear of the menu above and the greeting below. Its right edge goes
           past the rim by the rule's overhang plus 52 px (App Store) or 42 (Play), so
           the rounded top corner sits over the frame too. */
        const menu = pageBox(sp.at, MENU, "the menu button");
        const greeting = pageBox(sp.at, [45, 478, 470, 640], "the greeting");
        /*
         * The band between the menu above and the greeting below is narrower
         * than it was: the handset came down a tenth on 16 October and the
         * container that replaced the old pop-up is taller (the heavy rule
         * adds to every edge). So the card is fitted rather than assumed: the
         * largest size, from the set's own down to four fifths of it, that
         * keeps 8 px of corner over the rim, 20 px off the menu and 20 px off
         * the greeting. A card is 172 px tall per unit of scale (the disc at
         * 104, its padding 26 each way, the rule 8 each way).
         */
        let best = null;
        for (let k = 1; k >= 0.70 && !best; k -= 0.02) {
          const scale = m.card * k;
          const cardH = 172 * scale;
          const radius = 40 * scale;
          let menuGap = 24;
          const fit = (t) => {
            const r = Math.min(menu.x - menuGap, Math.max(Math.min(rimX(t), rimX(t + cardH)) + m.overhang + (ios ? 52 : 42), rimX(t) + 20, rimX(t + cardH) + 20));
            /* the overlap where the corner's curve meets the rim: the corner at 45 degrees */
            return { right: r, overlap: r - radius * (1 - Math.SQRT1_2) - rimX(t + radius * (1 - Math.SQRT1_2)) };
          };
          const clear = (t) => Math.hypot(Math.max(greeting.x - fit(t).right, 0), Math.max(greeting.y - (t + cardH), 0));
          let t = midY - cardH / 2;
          while (fit(t).overlap < 8 && clear(t + 1) >= 22) t += 1;
          while (fit(t).overlap < 8 && menuGap > 22) menuGap -= 1;
          const { right, overlap } = fit(t);
          if (overlap >= 8 && menu.x - right >= 20.5 && clear(t) >= 20.5) best = { scale, cardH, top: t, right, overlap };
        }
        /* nothing fitted: take the smallest and let the check report it */
        if (!best) {
          const scale = m.card * 0.70;
          const cardH = 172 * scale;
          const t = midY - cardH / 2;
          const r = Math.min(menu.x - 22, Math.max(rimX(t) + m.overhang + (ios ? 52 : 42), rimX(t) + 20));
          best = { scale, cardH, top: t, right: r, overlap: r - 40 * scale * (1 - Math.SQRT1_2) - rimX(t + 40 * scale * (1 - Math.SQRT1_2)) };
        }
        ctx.cornerOverlap = best.overlap;
        ctx.cardCheck = { avoid: [menu, greeting, pageBox(sp.at, CAMERA[ctx.model], "the camera")], minCornerOverlap: 8 };
        if (process.env.STORE_DEBUG) console.log(`  04 card: scale ${best.scale.toFixed(3)} of ${m.card.toFixed(3)}, top ${best.top.toFixed(0)}, right ${best.right.toFixed(0)}, menu gap ${(menu.x - best.right).toFixed(1)}, corner overlap ${best.overlap.toFixed(1)} px`);
        return lineCallout({ card: true, right: W - best.right, fit: true, y: best.top, lucide: "bed-double", title: "Room booked", line: "Lagoon Crest Resort · 3 nights", meta: null, example: true, scale: best.scale });
      },
    },
  ),

  std(6, "vallo-never-holds-your-money", "sc-payments", ["Vallo *never* holds", "your money"], { keyStyle: "chip" }),
  std(7, "see-the-stay-before-you-book", "n-resort", ["See the stay", "*before* you book"], { keyStyle: "chip" }),
  std(8, "ask-the-ai-assistant-any-time-of-day", "sc-assistant-start", ["Ask the AI assistant", "any time of day"]),
  std(9, "save-favourites-compare-later", "sc-saved", ["Save favourites,", "*compare* later"], { keyStyle: "chip" }),
  std(10, "find-a-restaurant-you-love", "sc-restaurant", ["Find a restaurant", "you *love*"], { keyStyle: "chip" }),
  std(11, "featured-homes-see-them-all", "n-home-featured", ["Featured homes,", "see them all"]),
  std(12, "each-verified-mark-checked-by-a-person", "sc-verification", ["Each verified mark,", "checked by a person"]),

  /* 13: the host's side. The payout arrives over the app's header, clear of
     the back button and the step bar below, and overhangs the phone's left
     edge. No amount. */
  std(13, "have-a-property-put-it-on-vallo", "f-host-start", ["Have a property?", "Put it on Vallo"], {
    async extra(ctx, m, p) {
      const [edge] = p.at(-m.frame, HEADER.top);
      const left = edge - m.overhang;
      /* under the camera and the status bar (its clock and its icons); two lines */
      const cam = pageBox(p.at, CAMERA[ctx.model], "the camera");
      const clock = pageBox(p.at, [40, 60, 300, 130], "the clock");
      const icons = pageBox(p.at, [1000, 60, 1290, 130], "the status icons");
      const back = pageBox(p.at, BACK, "the back button");
      const title = pageBox(p.at, TITLE, "the page title");
      ctx.cardCheck = { avoid: [cam, clock, icons, back, title, pageBox(p.at, [1138, 209, 1270, 341], "the bell")] };
      /* The card takes the band between the camera (or the clock) and the back button,
         22 px clear of each, at the set's card size or smaller if the band is shorter (a
         two-line card is 152.5 px tall per unit of scale). */
      const top = Math.max(cam.b + 22, clock.b + 24);
      const scale = Math.min(m.card, (back.y - 22 - top) / 172);
      ctx.cardScale = scale;
      if (process.env.STORE_DEBUG) console.log(`  13 card: top ${top.toFixed(0)}, scale ${scale.toFixed(3)} (set size ${m.card.toFixed(3)})`);
      return lineCallout({ card: true, x: left, fit: true, y: top, lucide: "landmark", title: "Payment settled", line: "Straight to your bank", meta: null, example: true, scale });
    },
  }),

  /* 14: the rent search, whose Map button sits over photographs, not over
     an Example chip. */
  std(14, "search-homes-across-nigeria", "n-search", ["*Search* homes", "across Nigeria"], { keyStyle: "chip" }),
  std(15, "ask-to-view-schedule-a-visit", "sc-thread", ["Ask to view,", "schedule a visit"]),
  std(16, "vallo-speaks-your-language", "n-welcome-yo", ["Vallo speaks", "your language"], { sub: "English, Hausa, Yorùbá and Igbo." }),
  std(17, "price-check-area-by-area", "sc-price", ["Price check,", "area by area"]),
  std(18, "pick-your-dates-see-the-price", "n-stays-dates", ["Pick your dates,", "see the price"]),
  std(19, "homes-to-buy-not-just-to-rent", "n-home-premium", ["Homes to *buy*,", "not just to rent"], { keyStyle: "chip" }),
  std(20, "rooms-and-nights-set-by-you", "f-host-rooms", ["Rooms and nights,", "set by you"]),
  std(21, "inspect-first-then-pay-on-vallo", "f-agreements", ["Inspect *first*,", "then pay on Vallo"], { keyStyle: "chip" }),
  std(22, "filter-down-to-what-you-need", "sc-filters", ["Filter down", "to what you need"]),
  std(23, "light-or-dark-your-call", "f-host-home-lt", ["Light or dark,", "your call"]),
  std(24, "rooms-amenities-all-laid-out", "n-stay", ["Rooms, amenities,", "all laid out"]),
  std(25, "the-guest-pays-the-price-you-set", "f-host-bookings", ["The guest pays", "the price you set"]),
  std(26, "earn-the-verified-mark", "f-agent-dashboard", ["Earn the", "*verified* mark"], { keyStyle: "chip" }),
  std(27, "new-homes-as-they-arrive", "n-home-new", ["New homes,", "as they arrive"]),
  std(28, "your-calendar-night-by-night", "f-host-calendar", ["Your calendar,", "night by night"]),
  std(29, "restaurants-all-in-one-place", "sc-restaurants", ["Restaurants,", "all in one place"]),
  std(30, "paste-the-message-you-already-send", "f-agent-listing-edit", ["*Paste* the message", "you already send"], { keyStyle: "chip" }),
  std(31, "pro-adds-tools-to-your-workspace", "f-pro", ["*Pro* adds tools", "to your workspace"], { keyStyle: "chip" }),
  std(32, "one-account-every-business", "f-host-settings", ["One account,", "every business"]),
  std(33, "the-agents-fees-spelled-out", "f-rent-movein", ["The agent’s fees,", "spelled out"]),
  std(34, "all-homes-list-or-map", "n-search-all", ["All homes,", "list or map"]),
  std(35, "vallo-real-estate-done-right", "n-welcome-en", ["Vallo. Real estate,", "done right."], { sub: "Homes, hotels, shortlets and restaurants." }),
];

/** Play's feature graphic, 1024 x 500, on the same night ground: the wordmark, one line, one phone. */
export async function FEATURE(ctx) {
  const p = await ctx.phone({ id: "n-home", cx: 766, cy: 258, h: 440, rotation: { x: -6, y: -16, z: 4 }, fov: 24, margin: 30, color: PHONE_COLOR });
  return [
    `<img class="abs" src="${brandUrl("vallo-wordmark.png")}" style="left:146px;top:146px;width:176px;z-index:30">`,
    `<div class="abs" style="left:144px;top:206px;width:460px;z-index:30;font:600 64px/1.04 Poppins;letter-spacing:-0.03em;color:#fff">Real estate,<br>done right.</div>`,
    p.html,
  ].join("\n");
}
