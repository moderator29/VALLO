import { useId } from "react";

/**
 * Tier one icons: the functional set for dense controls.
 *
 * The design direction calls for two icon tiers. Tier two is the 3D signature
 * object family, which carries a lit tile and reads beautifully from about 32px
 * up. Below that the tile collapses into an unreadable coloured square, so
 * dense UI needs a different instrument.
 *
 * These are stroked glyphs on a 24 grid. They inherit `currentColor`, so they
 * take the colour of whatever they sit beside, and they hold a real line at
 * 12px where a rendered 3D object cannot.
 *
 * THE SET WAS REDRAWN ON 29 SEPTEMBER 2026, ON LUCIDE GEOMETRY.
 *
 * The founder's references for the visual pass (`docs/design/references/
 * 2026-09-29/`) draw even line icons with round joins, the family SF Symbols,
 * Lucide and Phosphor all belong to. The previous set was hand-drawn glyph by
 * glyph over two months and it showed: live areas from 14 to 19 units, corner
 * radii from 1.2 to 4.2, three different ways of drawing a dot. The outlines
 * below are Lucide's (ISC, see `THIRD_PARTY_NOTICES.md` beside this file),
 * copied in as path data with no runtime dependency, so every glyph now shares
 * one live area (2 to 22), one corner radius (2, 1 on small parts), one dot
 * (`h.01` on a round cap) and round caps and joins throughout. Where Vallo had
 * a drawing Lucide does not (the four property-type houses, the two-card
 * feed, the shorter third menu line, the naira-free fee glyphs: `survey`,
 * and the estate `gate` keyhole shield), it is drawn here to the same rules.
 *
 * THE WEIGHT WENT BOLD THE SAME DAY (the founder, 29 September 2026: "premium,
 * bolder, solid, clean and sharp", with pump.fun's app icons as the target,
 * `22-pumpfun-drawer-bold-icons.png`). Those draw about 2 to 2.25 CSS px at
 * 24 with round joins and a SOLID twin for the selected state. The set stays
 * on Lucide rather than moving to Ionicons (the web face of `@expo/vector-
 * icons`) or Phosphor Bold, because 2 is the weight Lucide's geometry was
 * DRAWN for: its counters, gaps and dot spacing are tuned at 2, so raising
 * the line to it makes every glyph cleaner rather than clogging it, and the
 * set stays one family with one licence. Ionicons' outline set draws 1.5 at
 * 24 (32 on its 512 grid), which is the weight being left behind; Phosphor
 * Bold is a heavier 2.25 on rounder, wider geometry that would have meant a
 * second redraw of all ninety glyphs in a week. `UI_ICON_STROKE_PX` below is
 * 2.25 at the 20 and 24 steps, scaled optically per size by `uiIconStrokeWidth`.
 *
 * `docs/ICON_SYSTEM.md` carries the scale, the weight and the filled twins.
 */

export type UiIconName =
  | "search"
  | "search-disc"
  | "plus"
  | "minus"
  | "close"
  | "star"
  | "bed"
  | "bath"
  | "pool"
  | "wifi"
  | "parking"
  | "kitchen"
  | "verified"
  /* The identity tick: a filled circle with a white tick through it, which is
     what every governing render draws beside a name. `verified` stays the
     shield and belongs in a chip about a LISTING. */
  | "verified-badge"
  | "location"
  | "chevron-down"
  | "arrow-right"
  | "arrow-left"
  | "home"
  | "compass"
  | "building-hotel"
  | "building-apartment"
  | "house"
  | "utensils"
  | "ticket"
  | "calendar-booking"
  | "chat-bubble"
  | "bell"
  | "wallet"
  | "user"
  | "settings-gear"
  | "heart"
  | "grid"
  | "key"
  | "sliders"
  /* The search bar's order control: lines shortening downward [arrow-down-wide-narrow]. */
  | "sort"
  /* Open the chosen place, on the map's docked card [arrow-up-right]. */
  | "arrow-up-right"
  | "share"
  /* The feed's send: a paper plane, "send this to somebody", where `share`
     is the outbound tray a sheet of destinations opens from. */
  | "send"
  | "shield-stop"
  | "panel-left"
  | "menu"
  | "document"
  | "chevron-right"
  | "map"
  | "history"
  | "trash"
  | "repost"
  | "views"
  | "more"
  | "bookmark"
  | "picture"
  | "link"
  | "flag"
  | "mute"
  | "block"
  | "sun"
  | "moon"
  | "contrast"
  /* Property type and space, for the filter tiles (track J). */
  | "storefront"
  | "briefcase"
  | "land-plot"
  | "house-duplex"
  | "house-terrace"
  | "house-bungalow"
  | "tower-penthouse"
  | "door"
  | "check"
  | "archive"
  | "price-tag"
  | "eye"
  | "eye-off"
  | "arrow-up"
  | "arrow-down"
  | "info"
  | "mail"
  /* Electricity. A listing's power supply is one of the facts that decides a
     Nigerian tenancy; nothing else stands in for it. */
  | "bolt"
  /* The feed: two stacked cards. Not `grid`, which is a launcher. */
  | "feed"
  /* THE FOUR BRAND MARKS. Somebody else's silhouettes, filled rather than
     stroked, because a house-style approximation of a store or social mark is
     one a reader does not recognise. They take `currentColor` like the rest. */
  | "apple"
  | "google-play"
  | "x-social"
  | "telegram"
  | "phone"
  /* The dock's centre switch: two straight opposed arrows. NOT `repost`,
     which turns two corners and means a post sent on. */
  | "switch-profile"
  /* THE LISTING PAGE'S COST AND UTILITY GLYPHS (29 September 2026). They
     replaced the glass objects on the fee rows and the light, water and gate
     rows, so each cost reads as one thing at 20px on a plate. */
  | "coins"
  | "scale"
  | "certificate"
  | "stamp"
  | "survey"
  | "droplet"
  | "gate"
  /* THE ROW AND CARD GLYPHS (29 September 2026, the icon upgrade). Lucide
     drawings that replaced the glass objects on rows, cards, sheet heads
     and KPI tiles, and the hand-drawn settings, feed and console glyphs, so
     every plate on the platform draws from this one set. */
  | "shield-check"
  | "globe"
  | "headset"
  | "log-out"
  | "camera"
  | "pencil"
  | "users"
  | "lock"
  | "calendar-check"
  | "calendar-clock"
  | "clock"
  | "credit-card"
  | "bank"
  | "concierge-bell"
  | "alert-triangle"
  | "chart-bar"
  | "trending-up"
  | "file-text"
  | "file-check"
  | "file-search"
  | "user-check"
  | "user-pen"
  | "messages"
  | "bot"
  | "id-card"
  | "receipt"
  | "hand-coins"
  | "banknote"
  | "hourglass"
  | "circle-check"
  | "circle-x"
  | "clipboard-list"
  | "square-check"
  /* The feed's repost as a LEVEL loop (the feed image), beside `repost`. */
  | "repost-loop"
  | "shield-lock"
  /* The motion levels (Settings, Motion): play is standard, pause is off. */
  | "circle-play"
  | "circle-pause"
  /* THE SPARKLE IS GONE (the founder, 7 October 2026: "what kind of icon is
     that? Don't use it... use a real icon for each thing"). The four-point
     star stood for the assistant, Pro, For you, "recommended", air
     conditioning, laundry and Cinematic motion, which is to say for nothing.
     Each meaning now has its own object: `bot` the assistant, `crown` Pro,
     `house-heart` For you, `gift` a reward, `snowflake` air conditioning,
     `washing-machine` laundry, `film` Cinematic. `sparkle-ban.test.ts`
     refuses the name anywhere in the source. */
  | "crown"
  | "house-heart"
  | "gift"
  | "snowflake"
  | "washing-machine"
  | "film"
  /* VC1, THE CALL GLYPHS (8 October 2026): the thread header's voice and
     video buttons, the call screen's controls and the history rows. Lucide
     drawings with solid twins, because the call controls are solid (D78). */
  | "video"
  | "video-off"
  | "mic"
  | "mic-off"
  | "phone-missed"
  | "phone-incoming"
  | "phone-outgoing"
  | "switch-camera"
  | "volume";

/*
 * THE OUTLINES. Lucide names in brackets where the drawing is Lucide's, so the
 * next redraw can find its source; no bracket means Vallo's own on the same
 * rules. Every stroke takes the svg's computed width, round caps, round joins.
 */
const PATHS: Record<UiIconName, React.ReactNode> = {
  // [video]
  video: (
    <>
      <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" />
      <rect x="2" y="6" width="14" height="12" rx="2" />
    </>
  ),
  // [video-off]
  "video-off": (
    <>
      <path d="M10.66 6H14a2 2 0 0 1 2 2v2.5l5.248-3.062A.5.5 0 0 1 22 7.87v8.196" />
      <path d="M16 16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2" />
      <path d="m2 2 20 20" />
    </>
  ),
  // [mic]
  mic: (
    <>
      <path d="M12 19v3" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <rect x="9" y="2" width="6" height="13" rx="3" />
    </>
  ),
  // [mic-off]
  "mic-off": (
    <>
      <path d="M12 19v3" />
      <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
      <path d="M16.95 16.95A7 7 0 0 1 5 12v-2" />
      <path d="M18.89 13.23A7 7 0 0 0 19 12v-2" />
      <path d="m2 2 20 20" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
    </>
  ),
  // [phone-missed]
  "phone-missed": (
    <>
      <path d="m16 2 6 6" />
      <path d="m22 2-6 6" />
      <path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384" />
    </>
  ),
  // [phone-incoming]
  "phone-incoming": (
    <>
      <path d="M16 2v6h6" />
      <path d="m22 2-6 6" />
      <path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384" />
    </>
  ),
  // [phone-outgoing]
  "phone-outgoing": (
    <>
      <path d="m16 8 6-6" />
      <path d="M22 8V2h-6" />
      <path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384" />
    </>
  ),
  // [switch-camera]
  "switch-camera": (
    <>
      <path d="M11 19H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" />
      <path d="M13 5h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-5" />
      <circle cx="12" cy="12" r="3" />
      <path d="m18 22-3-3 3-3" />
      <path d="m6 2 3 3-3 3" />
    </>
  ),
  // [volume-2]
  volume: (
    <>
      <path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z" />
      <path d="M16 9a5 5 0 0 1 0 6" />
      <path d="M19.364 18.364a9 9 0 0 0 0-12.728" />
    </>
  ),
  // [phone]
  phone: (
    <path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384" />
  ),
  // [arrow-right-left]
  "switch-profile": (
    <>
      <path d="m16 3 4 4-4 4" />
      <path d="M20 7H4" />
      <path d="m8 21-4-4 4-4" />
      <path d="M4 17h16" />
    </>
  ),
  apple: (
    <g stroke="none" fill="currentColor">
      <path d="M17.05 12.53c-.02-2.2 1.8-3.27 1.88-3.32-1.02-1.5-2.61-1.7-3.18-1.73-1.35-.14-2.64.8-3.33.8-.69 0-1.75-.78-2.87-.76-1.48.02-2.84.86-3.6 2.18-1.53 2.66-.39 6.6 1.1 8.76.73 1.06 1.6 2.25 2.74 2.2 1.1-.04 1.52-.71 2.85-.71 1.33 0 1.7.71 2.87.69 1.19-.02 1.94-1.08 2.66-2.14.84-1.23 1.19-2.42 1.21-2.48-.03-.01-2.32-.89-2.34-3.53z" />
      <path d="M14.87 6.1c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.55 1.31-.56.65-1.05 1.68-.92 2.67.97.08 1.96-.49 2.57-1.22z" />
    </g>
  ),
  "google-play": (
    <g stroke="none" fill="currentColor">
      <path d="M3.9 2.4c-.25.26-.4.67-.4 1.2v16.8c0 .53.15.94.4 1.2l.06.05 9.4-9.4v-.5L3.96 2.35z" />
      <path d="M16.5 15.7l-3.14-3.15v-.5L16.5 8.9l.07.04 3.72 2.12c1.06.6 1.06 1.59 0 2.2l-3.72 2.11z" />
      <path d="M16.57 15.66L13.36 12.4 3.9 21.6c.35.37.93.42 1.58.05l11.09-6z" />
      <path d="M16.57 8.94L5.48 2.9c-.65-.37-1.23-.32-1.58.05l9.46 9.2z" />
    </g>
  ),
  "x-social": (
    <g stroke="none" fill="currentColor">
      <path d="M17.53 3h2.98l-6.51 7.44L21.66 21h-5.99l-4.7-6.14L5.6 21H2.62l6.96-7.96L2.34 3h6.14l4.24 5.61L17.53 3zm-1.05 16.22h1.65L7.6 4.69H5.83l10.65 14.53z" />
    </g>
  ),
  telegram: (
    <g stroke="none" fill="currentColor">
      <path d="M21.94 4.3 18.9 19.2c-.23 1.02-.84 1.27-1.7.79l-4.7-3.46-2.27 2.18c-.25.25-.46.46-.95.46l.34-4.8 8.73-7.89c.38-.34-.08-.53-.59-.19L6.98 13.1l-4.65-1.45c-1.01-.32-1.03-1.01.21-1.5l18.15-7c.84-.31 1.58.19 1.25 1.15z" />
    </g>
  ),
  /* Filters [sliders-horizontal]: rails lying flat. Settings stands the same
     rails upright, and one mark means one thing. */
  sliders: (
    <>
      <path d="M10 5H3" />
      <path d="M12 19H3" />
      <path d="M14 3v4" />
      <path d="M16 17v4" />
      <path d="M21 12h-9" />
      <path d="M21 19h-5" />
      <path d="M21 5h-7" />
      <path d="M8 10v4" />
      <path d="M8 12H3" />
    </>
  ),
  // [share]: the outbound tray.
  share: (
    <>
      <path d="M12 2v13" />
      <path d="m16 6-4-4-4 4" />
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
    </>
  ),
  /* [send]: the paper plane under a post and a story. It sends the post to a
     person, which is what people do with a home they want somebody to see. */
  send: (
    <>
      <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" />
      <path d="m21.854 2.147-10.94 10.939" />
    </>
  ),
  // [map]: a folded sheet, so it reads as a map rather than a pin.
  map: (
    <>
      <path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z" />
      <path d="M15 5.764v15" />
      <path d="M9 3.236v15" />
    </>
  ),
  // [search]
  search: (
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.34-4.34" />
    </>
  ),
  /* The dock's Search (B1 second ruling, references 44 and 45): a magnifier
     in a disc, so its solid twin is a disc with the magnifier cut out, the
     way the references' own round glyphs are drawn. The line form is the
     ring and the magnifier, for the rare place it rests outlined. */
  "search-disc": (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <circle cx="11.25" cy="11.25" r="3.5" />
      <path d="m16 16-2.25-2.25" />
    </>
  ),
  // [plus] [minus]: drawn, never typed, so they sit on the stroke language.
  plus: (
    <>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </>
  ),
  minus: <path d="M5 12h14" />,
  // [star]
  star: (
    <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
  ),
  // [bed-double]: the Stays tab. A double bed reads as a room to sleep in.
  bed: (
    <>
      <path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8" />
      <path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4" />
      <path d="M12 4v6" />
      <path d="M2 18h20" />
    </>
  ),
  // [bath]
  bath: (
    <>
      <path d="M10 4 8 6" />
      <path d="M17 19v2" />
      <path d="M2 12h20" />
      <path d="M7 19v2" />
      <path d="M9 5 7.621 3.621A2.121 2.121 0 0 0 4 5v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" />
    </>
  ),
  // [waves-ladder]: a pool is water with a ladder into it.
  pool: (
    <>
      <path d="M19 5a2 2 0 0 0-2 2v11" />
      <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
      <path d="M7 13h10" />
      <path d="M7 9h10" />
      <path d="M9 5a2 2 0 0 0-2 2v11" />
    </>
  ),
  // [wifi]
  wifi: (
    <>
      <path d="M12 20h.01" />
      <path d="M2 8.82a15 15 0 0 1 20 0" />
      <path d="M5 12.859a10 10 0 0 1 14 0" />
      <path d="M8.5 16.429a5 5 0 0 1 7 0" />
    </>
  ),
  // [square-parking]
  parking: (
    <>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 17V7h4a3 3 0 0 1 0 6H9" />
    </>
  ),
  // [refrigerator]: the kitchen fact on a listing.
  kitchen: (
    <>
      <path d="M5 6a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6Z" />
      <path d="M5 10h14" />
      <path d="M15 7v6" />
    </>
  ),
  /* [shield-check]: "this LISTING was checked". A person's check is
     `verified-badge`; the shield and the disc are different ideas. */
  verified: (
    <>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  /* The identity tick [circle-check], drawn as a closed disc with the tick
     knocked through in the on-brand ink, so it reads at 12 to 14px beside a
     name. The disc takes `currentColor`: the call site decides brand or
     emerald. The tick carries its own width because it sits on a fill, where
     the family's line would read thin. */
  "verified-badge": (
    <>
      <circle cx="12" cy="12" r="10" fill="currentColor" stroke="none" />
      <path
        d="m16.2 9-5.6 5.6L7.8 11.8"
        fill="none"
        stroke="var(--nf-content-on-brand)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  // [file-text]: terms, and any page that is a document rather than a place.
  document: (
    <>
      <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />
      <path d="M14 2v5a1 1 0 0 0 1 1h5" />
      <path d="M10 9H8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </>
  ),
  /* THE MENU. Three lines, the third shorter, which points the glyph's weight
     at the leading edge the drawer arrives from. Lucide's spacing, closed up
     to 6 units so the three read as one control at 20px. */
  menu: <path d="M4 6h16M4 12h16M4 18h10" />,
  // [panel-left]
  "panel-left": (
    <>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 3v18" />
    </>
  ),
  // [chevron-right] [chevron-down]
  "chevron-right": <path d="m9 18 6-6-6-6" />,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  /* [shield-minus]: an agent stopped from trading. The same shield as
     `verified` to the unit, with a bar where the tick goes, so the two read
     as one judgement pointing opposite ways. */
  "shield-stop": (
    <>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="M9 12h6" />
    </>
  ),
  // [map-pin]
  location: (
    <>
      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  // [arrow-right] [arrow-left] [arrow-up] [arrow-down]
  "arrow-right": (
    <>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </>
  ),
  "arrow-left": (
    <>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </>
  ),
  "arrow-up": (
    <>
      <path d="m5 12 7-7 7 7" />
      <path d="M12 19V5" />
    </>
  ),
  "arrow-down": (
    <>
      <path d="M12 5v14" />
      <path d="m19 12-7 7-7-7" />
    </>
  ),
  // [arrow-up-right]: out of the map, into the place.
  "arrow-up-right": (
    <>
      <path d="M7 7h10v10" />
      <path d="M7 17 17 7" />
    </>
  ),
  // [arrow-down-wide-narrow]: the order of the results.
  sort: (
    <>
      <path d="m3 16 4 4 4-4" />
      <path d="M7 20V4" />
      <path d="M11 4h10" />
      <path d="M11 8h7" />
      <path d="M11 12h4" />
    </>
  ),
  // [crown]: Pro, the paid tier.
  crown: (
    <>
      <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
      <path d="M5 21h14" />
    </>
  ),
  // [house-heart]: For you, homes picked for this member.
  "house-heart": (
    <>
      <path d="M8.62 13.8A2.25 2.25 0 1 1 12 10.836a2.25 2.25 0 1 1 3.38 2.966l-2.626 2.856a.998.998 0 0 1-1.507 0z" />
      <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </>
  ),
  // [gift]: a reward or a bonus.
  gift: (
    <>
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M12 8v13" />
      <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
      <path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" />
    </>
  ),
  // [snowflake]: air conditioning.
  snowflake: (
    <>
      <path d="m10 20-1.25-2.5L6 18" />
      <path d="M10 4 8.75 6.5 6 6" />
      <path d="m14 20 1.25-2.5L18 18" />
      <path d="m14 4 1.25 2.5L18 6" />
      <path d="m17 21-3-6h-4" />
      <path d="m17 3-3 6 1.5 3" />
      <path d="M2 12h6.5L10 9" />
      <path d="m20 10-1.5 2 1.5 2" />
      <path d="M22 12h-6.5L14 15" />
      <path d="m4 10 1.5 2L4 14" />
      <path d="m7 21 3-6-1.5-3" />
      <path d="m7 3 3 6h4" />
    </>
  ),
  // [washing-machine]: laundry.
  "washing-machine": (
    <>
      <path d="M3 6h3" />
      <path d="M17 6h.01" />
      <rect width="18" height="20" x="3" y="2" rx="2" />
      <circle cx="12" cy="13" r="5" />
      <path d="M12 18a2.5 2.5 0 0 0 0-5 2.5 2.5 0 0 1 0-5" />
    </>
  ),
  // [film]: the Cinematic motion level.
  film: (
    <>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M7 3v18" />
      <path d="M3 7.5h4" />
      <path d="M3 12h18" />
      <path d="M3 16.5h4" />
      <path d="M17 3v18" />
      <path d="M17 7.5h4" />
      <path d="M17 16.5h4" />
    </>
  ),
  // [house]: the Home tab.
  home: (
    <>
      <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
      <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </>
  ),
  /* A house as a property rather than as the Home tab: the same body with a
     chimney on the right-hand pitch, so the two never read as one glyph. */
  house: (
    <>
      <path d="M15 21v-6a3 3 0 0 0-6 0v6" />
      <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M16.5 5.14V3.5a.5.5 0 0 1 .5-.5h1.5a.5.5 0 0 1 .5.5v3.78" />
    </>
  ),
  // [compass]: Explore.
  compass: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z" />
    </>
  ),
  /* [hotel]: a block with an arched entrance and six windows drawn as single
     round dots. The old facade's twelve window ticks turned into a grey
     texture at 20px; six dots on a 4-unit pitch stay six dots. */
  "building-hotel": (
    <>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M10 22v-6.57" />
      <path d="M14 15.43V22" />
      <path d="M15 16a5 5 0 0 0-6 0" />
      <path d="M8 7h.01M12 7h.01M16 7h.01M8 11h.01M12 11h.01M16 11h.01" />
    </>
  ),
  // [building-2]: an apartment block with a lower wing.
  "building-apartment": (
    <>
      <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
      <path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2" />
      <path d="M10 8h4" />
      <path d="M10 12h4" />
      <path d="M14 21v-3a2 2 0 0 0-4 0v3" />
    </>
  ),
  // [utensils]
  utensils: (
    <>
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
      <path d="M7 2v20" />
      <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
    </>
  ),
  // [ticket]: Help and support.
  ticket: (
    <>
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
      <path d="M13 5v2" />
      <path d="M13 11v2" />
      <path d="M13 17v2" />
    </>
  ),
  /* [calendar-check]: a booking. The tick is what says BOOKED rather than
     DATE, so it stays. */
  "calendar-booking": (
    <>
      <path d="M8 2v3" />
      <path d="M16 2v3" />
      <rect x="3" y="3.5" width="18" height="18" rx="2" />
      <path d="M3 9.5h18" />
      <path d="m9 15.5 2 2 4-4" />
    </>
  ),
  // [message-circle]: the round bubble every current platform draws.
  "chat-bubble": (
    <path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719z" />
  ),
  // [bell]
  bell: (
    <>
      <path d="M10.268 21a2 2 0 0 0 3.464 0" />
      <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
    </>
  ),
  // [wallet]
  wallet: (
    <>
      <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
      <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
    </>
  ),
  // [user]
  user: (
    <>
      <circle cx="12" cy="7" r="4" />
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    </>
  ),
  /* SETTINGS [sliders-vertical]: three upright rails, each handle at a
     different height. NOT a gear (the founder, 25 September 2026: one clean,
     clear settings mark wherever settings appears). The name stays
     `settings-gear` so every call site changes at once. */
  "settings-gear": (
    <>
      <path d="M5 21v-7" />
      <path d="M5 10V3" />
      <path d="M12 21v-9" />
      <path d="M12 8V3" />
      <path d="M19 21v-5" />
      <path d="M19 12V3" />
      <path d="M3 14h4" />
      <path d="M10 8h4" />
      <path d="M17 16h4" />
    </>
  ),
  // [heart]
  heart: (
    <path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" />
  ),
  // [layout-grid]
  grid: (
    <>
      <rect width="7" height="7" x="3" y="3" rx="1.5" />
      <rect width="7" height="7" x="14" y="3" rx="1.5" />
      <rect width="7" height="7" x="14" y="14" rx="1.5" />
      <rect width="7" height="7" x="3" y="14" rx="1.5" />
    </>
  ),
  // [zap]
  bolt: (
    <path d="M15.914 4a1.5 1.5 0 0 0-2.474-1.561l-9 9A1.5 1.5 0 0 0 5.5 14h4.002a.5.5 0 0 1 .471.666L8.086 20a1.5 1.5 0 0 0 2.475 1.56l9-9A1.5 1.5 0 0 0 18.5 10h-3.997a.5.5 0 0 1-.472-.667z" />
  ),
  /* The feed: two stacked cards at the family's radius. One wide card with
     lines under it read as a monitor; four squares read as a launcher. */
  feed: (
    <>
      <rect x="3" y="3" width="18" height="7.5" rx="2" />
      <rect x="3" y="13.5" width="18" height="7.5" rx="2" />
    </>
  ),
  // [key]
  key: (
    <>
      <path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4" />
      <path d="m21 2-9.6 9.6" />
      <circle cx="7.5" cy="15.5" r="5.5" />
    </>
  ),
  // [x]: never the typographic multiplication sign.
  close: (
    <>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </>
  ),
  // [history]: a clock face with a rewind arrow.
  history: (
    <>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </>
  ),
  // [trash-2]
  trash: (
    <>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </>
  ),
  /* [repeat-2]: two rails, each turning one corner, with the arrowheads at
     opposite ends. A post sent on. Not `switch-profile`. */
  repost: (
    <>
      <path d="m2 9 3-3 3 3" />
      <path d="M13 18H7a2 2 0 0 1-2-2V6" />
      <path d="m22 15-3 3-3-3" />
      <path d="M11 6h6a2 2 0 0 1 2 2v10" />
    </>
  ),
  /* [chart-no-axes-column-increasing]: views as three rising bars.
     Deliberately not an eye, which says "we are watching you". */
  views: (
    <>
      <path d="M5 21v-6" />
      <path d="M12 21V9" />
      <path d="M19 21V3" />
    </>
  ),
  /* [ellipsis]: three nodes, filled so they hold their size whatever the
     stroke weight at the step. */
  more: (
    <g fill="currentColor" stroke="none">
      <circle cx="5" cy="12" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="19" cy="12" r="1.75" />
    </g>
  ),
  // [bookmark]
  bookmark: (
    <path d="M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z" />
  ),
  // [image]
  picture: (
    <>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </>
  ),
  // [link]
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </>
  ),
  // [flag]: report.
  flag: (
    <path d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528" />
  ),
  /* [bell-off]: muting is not blocking. The bell is still there, cut. */
  mute: (
    <>
      <path d="M10.268 21a2 2 0 0 0 3.464 0" />
      <path d="M17 17H4a1 1 0 0 1-.74-1.673C4.59 13.956 6 12.499 6 8a6 6 0 0 1 .258-1.742" />
      <path d="m2 2 20 20" />
      <path d="M8.668 3.01A6 6 0 0 1 18 8c0 2.687.77 4.653 1.707 6.05" />
    </>
  ),
  // [ban]: the one deliberately universal mark, for the most permanent action.
  block: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M4.929 4.929 19.07 19.071" />
    </>
  ),
  // [sun] [moon] [contrast]: the three theme choices, as one set.
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </>
  ),
  moon: (
    <path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401" />
  ),
  contrast: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 18a6 6 0 0 0 0-12v12z" />
    </>
  ),
  /* PROPERTY TYPE AND SPACE (track J). Lucide's where it has the object,
     Vallo's own where it does not, on the same live area, radius and dot. */
  // [store]
  storefront: (
    <>
      <path d="M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5" />
      <path d="M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244" />
      <path d="M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05" />
    </>
  ),
  // [briefcase]
  briefcase: (
    <>
      <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      <rect width="20" height="14" x="2" y="6" rx="2" />
    </>
  ),
  // [land-plot]
  "land-plot": (
    <>
      <path d="m12 8 6-3-6-3v10" />
      <path d="m8 11.99-5.5 3.14a1 1 0 0 0 0 1.74l8.5 4.86a2 2 0 0 0 2 0l8.5-4.86a1 1 0 0 0 0-1.74L16 12" />
      <path d="m6.49 12.85 11.02 6.3" />
      <path d="M17.51 12.85 6.5 19.15" />
    </>
  ),
  // Two storeys under one roof: a floor line, two upper windows, a door.
  "house-duplex": (
    <>
      <path d="m3 10 8.36-6.97a1 1 0 0 1 1.28 0L21 10" />
      <path d="M5 8.5V19a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5" />
      <path d="M5 14h14" />
      <path d="M9.5 10.5h.01M14.5 10.5h.01" />
      <path d="M10 21v-3a2 2 0 0 1 4 0v3" />
    </>
  ),
  // A terrace: three gables on one body, with the party walls between.
  "house-terrace": (
    <>
      <path d="m2 10.5 3.33-3.8L8.67 10.5 12 6.7l3.33 3.8 3.34-3.8L22 10.5" />
      <path d="M3 9.5V19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9.5" />
      <path d="M8.67 13v8M15.33 13v8" />
    </>
  ),
  // A bungalow: one low, wide storey under a shallow roof.
  "house-bungalow": (
    <>
      <path d="m2 12 9.2-5.5a1.5 1.5 0 0 1 1.6 0L22 12" />
      <path d="M4 11v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <path d="M10 21v-3a2 2 0 0 1 4 0v3" />
      <path d="M7 14.5h1.5M15.5 14.5H17" />
    </>
  ),
  // A tower with a pitched cap: the penthouse is the roof.
  "tower-penthouse": (
    <>
      <path d="m5.5 9.5 5.86-5.02a1 1 0 0 1 1.28 0L18.5 9.5" />
      <path d="M7 8.3V21M17 8.3V21" />
      <path d="M3 21h18" />
      <path d="M10 12h.01M14 12h.01M10 15.5h.01M14 15.5h.01" />
    </>
  ),
  // [door-closed]
  door: (
    <>
      <path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16" />
      <path d="M2 21h20" />
      <path d="M15 12h.01" />
    </>
  ),
  /* [check]: a plain tick for a SELECTED state. Deliberately not `verified`,
     which is the human-checked mark and means one thing. */
  check: <path d="M20 6 9 17l-5-5" />,
  /* [tag]: Price Check. The shop-window price, not a coin or a naira sign:
     the page reports what places are ASKING, not a sum anybody owes. */
  "price-tag": (
    <>
      <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
      <circle cx="7.5" cy="7.5" r="1.25" fill="currentColor" stroke="none" />
    </>
  ),
  // [archive]
  archive: (
    <>
      <rect width="20" height="5" x="2" y="3" rx="1" />
      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
      <path d="M10 12h4" />
    </>
  ),
  // [eye] [eye-off]: reveal a password, and its own name for "hidden".
  eye: (
    <>
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  "eye-off": (
    <>
      <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
      <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
      <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
      <path d="m2 2 20 20" />
    </>
  ),
  // [info]
  info: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </>
  ),
  // [mail]
  mail: (
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" />
    </>
  ),
  // [coins]: the total a buyer or a tenant has to find.
  coins: (
    <>
      <path d="M13.744 17.736a6 6 0 1 1-7.48-7.48" />
      <path d="M15 6h1v4" />
      <path d="m6.134 14.768.866-.5 2 3.464" />
      <circle cx="16" cy="8" r="6" />
    </>
  ),
  // [scale]: the legal fee. The law's own mark, not a document.
  scale: (
    <>
      <path d="M12 3v18" />
      <path d="m19 8 3 8a5 5 0 0 1-6 0zV7" />
      <path d="M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1" />
      <path d="m5 8 3 8a5 5 0 0 1-6 0zV7" />
      <path d="M7 21h10" />
    </>
  ),
  /* [award]: Governor's consent. A seal on a ribbon, the certificate a
     transfer is not valid without. */
  certificate: (
    <>
      <path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526" />
      <circle cx="12" cy="8" r="6" />
    </>
  ),
  // [stamp]: stamp duty.
  stamp: (
    <>
      <path d="M14 13V8.5C14 7 15 7 15 5a3 3 0 0 0-6 0c0 2 1 2 1 3.5V13" />
      <path d="M20 15.5a2.5 2.5 0 0 0-2.5-2.5h-11A2.5 2.5 0 0 0 4 15.5V17a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1z" />
      <path d="M5 22h14" />
    </>
  ),
  /* Survey and registration: a pin set on a measuring rule. Vallo's own, on
     the family's radius and dot. */
  survey: (
    <>
      <path d="M17 7.5c0 3.2-3.6 6-4.6 6.8a.7.7 0 0 1-.8 0C10.6 13.5 7 10.7 7 7.5a5 5 0 0 1 10 0" />
      <path d="M12 7.5h.01" />
      <rect x="2" y="17" width="20" height="5" rx="1" />
      <path d="M6 17v2M10 17v2M14 17v2M18 17v2" />
    </>
  ),
  // [droplet]: water supply.
  droplet: (
    <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" />
  ),
  /* The estate gate: a shield with a keyhole, controlled access. Vallo's own,
     on `verified`'s Lucide shield so the two sit as a pair; the tick is a
     judgement, the keyhole is a way in. It replaced a drawn gate (two piers,
     an arched rail, two bars, a cross rail) on 29 September 2026: at 20px
     on the bold line its five parallel strokes closed into a hash and read
     as a grid, not a gate. The keyhole is a solid dot on a short stem so it
     stays open inside the shield at 2.25px. */
  gate: (
    <>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <circle cx="12" cy="10.5" r="1.25" fill="currentColor" />
      <path d="M12 12v3.5" />
    </>
  ),
  /* The row and card glyphs (see the union above). */
  // [shield-check]
  "shield-check": (
    <>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  // [globe]
  globe: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </>
  ),
  // [headset]
  headset: (
    <>
      <path d="M3 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5Zm0 0a9 9 0 1 1 18 0m0 0v5a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3Z" />
      <path d="M21 16v2a4 4 0 0 1-4 4h-5" />
    </>
  ),
  // [log-out]
  "log-out": (
    <>
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    </>
  ),
  // [camera]
  camera: (
    <>
      <path d="M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z" />
      <circle cx="12" cy="13" r="3" />
    </>
  ),
  // [pencil]
  pencil: (
    <>
      <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
      <path d="m15 5 4 4" />
    </>
  ),
  // [users-round]
  users: (
    <>
      <path d="M18 21a8 8 0 0 0-16 0" />
      <circle cx="10" cy="8" r="5" />
      <path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3" />
    </>
  ),
  // [lock]
  lock: (
    <>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  // [calendar-check]
  "calendar-check": (
    <>
      <path d="M8 2v3" />
      <path d="M16 2v3" />
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18" />
      <path d="m9 15 2 2 4-4" />
    </>
  ),
  // [calendar-clock]
  "calendar-clock": (
    <>
      <path d="M16 14v2.2l1.6 1" />
      <path d="M16 2v3" />
      <path d="M21 7.338V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h2.338" />
      <path d="M3 9h5.859" />
      <path d="M8 2v3" />
      <circle cx="16" cy="16" r="6" />
    </>
  ),
  // [clock]
  clock: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </>
  ),
  // [credit-card]
  "credit-card": (
    <>
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" x2="22" y1="10" y2="10" />
      <path d="M6 14h2" />
    </>
  ),
  // [landmark]
  bank: (
    <>
      <path d="M10 18v-7" />
      <path d="M11.119 2.205a2 2 0 0 1 1.762 0l7.84 3.846A.5.5 0 0 1 20.5 7h-17a.5.5 0 0 1-.22-.949z" />
      <path d="M14 18v-7" />
      <path d="M18 18v-7" />
      <path d="M3 22h18" />
      <path d="M6 18v-7" />
    </>
  ),
  // [concierge-bell]
  "concierge-bell": (
    <>
      <path d="M3 20a1 1 0 0 1-1-1v-1a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1Z" />
      <path d="M20 16a8 8 0 1 0-16 0" />
      <path d="M12 4v4" />
      <path d="M10 4h4" />
    </>
  ),
  // [triangle-alert]
  "alert-triangle": (
    <>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </>
  ),
  // [chart-column]
  "chart-bar": (
    <>
      <path d="M3 3v16a2 2 0 0 0 2 2h16" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </>
  ),
  // [trending-up]
  "trending-up": (
    <>
      <path d="M16 7h6v6" />
      <path d="m22 7-8.5 8.5-5-5L2 17" />
    </>
  ),
  // [file-text]
  "file-text": (
    <>
      <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />
      <path d="M14 2v5a1 1 0 0 0 1 1h5" />
      <path d="M10 9H8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </>
  ),
  // [file-check]
  "file-check": (
    <>
      <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />
      <path d="M14 2v5a1 1 0 0 0 1 1h5" />
      <path d="m9 15 2 2 4-4" />
    </>
  ),
  // [file-search]
  "file-search": (
    <>
      <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />
      <path d="M14 2v5a1 1 0 0 0 1 1h5" />
      <circle cx="11.5" cy="14.5" r="2.5" />
      <path d="M13.3 16.3 15 18" />
    </>
  ),
  // [user-check]
  "user-check": (
    <>
      <path d="m16 11 2 2 4-4" />
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
    </>
  ),
  // [user-pen]
  "user-pen": (
    <>
      <path d="M11.5 15H7a4 4 0 0 0-4 4v2" />
      <path d="M21.378 16.626a1 1 0 0 0-3.004-3.004l-4.01 4.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z" />
      <circle cx="10" cy="7" r="4" />
    </>
  ),
  // [messages-square]
  messages: (
    <>
      <path d="M16 10a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 14.286V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      <path d="M20 9a2 2 0 0 1 2 2v10.286a.71.71 0 0 1-1.212.502l-2.202-2.202A2 2 0 0 0 17.172 19H10a2 2 0 0 1-2-2v-1" />
    </>
  ),
  // [bot]
  bot: (
    <>
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2" />
      <path d="M20 14h2" />
      <path d="M15 13v2" />
      <path d="M9 13v2" />
    </>
  ),
  // [id-card]
  "id-card": (
    <>
      <path d="M13 19a4 4 0 00-8 0" />
      <path d="M16 10h2" />
      <path d="M16 14h2" />
      <circle cx="9" cy="12" r="3" />
      <rect x="2" y="5" width="20" height="14" rx="2" />
    </>
  ),
  // [receipt-text]: the torn-edge slip with three lines of text. It used to draw
  // a dollar sign, which is the wrong currency on a naira product; the lines say
  // "a record" without naming one.
  receipt: (
    <>
      <path d="M14 8H8" />
      <path d="M16 12H8" />
      <path d="M13 16H8" />
      <path d="M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z" />
    </>
  ),
  // [hand-coins]
  "hand-coins": (
    <>
      <path d="M11 15h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 17" />
      <path d="m7 21 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9" />
      <path d="m2 16 6 6" />
      <circle cx="16" cy="9" r="2.9" />
      <circle cx="6" cy="5" r="3" />
    </>
  ),
  // [banknote]
  banknote: (
    <>
      <rect width="20" height="12" x="2" y="6" rx="2" />
      <circle cx="12" cy="12" r="2" />
      <path d="M6 12h.01M18 12h.01" />
    </>
  ),
  // [hourglass]
  hourglass: (
    <>
      <path d="M5 22h14" />
      <path d="M5 2h14" />
      <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
      <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
    </>
  ),
  // [circle-check]
  "circle-check": (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="m16 9-5.5 5.5L8 12" />
    </>
  ),
  // [circle-x]
  "circle-x": (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </>
  ),
  // [clipboard-list]
  "clipboard-list": (
    <>
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M12 11h4" />
      <path d="M12 16h4" />
      <path d="M8 11h.01" />
      <path d="M8 16h.01" />
    </>
  ),
  // [square-check]
  "square-check": (
    <>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="m16 9-5.5 5.5L8 12" />
    </>
  ),
  // [repeat]
  "repost-loop": (
    <>
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="m7 22-4-4 4-4" />
      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </>
  ),
  // [shield-lock]
  "shield-lock": (
    <>
      <path d="M20 9.807V6a1 1 0 00-1-1c-2 0-4.49-1.19-6.24-2.72a1.17 1.17 0 00-1.52 0C9.5 3.8 7 5 5 5a1 1 0 00-1 1v7c0 3.88 2.107 6.254 5 7.796" />
      <path d="M19 17v-2a2 2 0 00-4 0v2" />
      <rect x="13" y="17" width="8" height="5" rx="1" />
    </>
  ),
  // [circle-play]
  "circle-play": (
    <>
      <path d="M9 9.003a1 1 0 0 1 1.517-.859l4.997 2.997a1 1 0 0 1 0 1.718l-4.997 2.997A1 1 0 0 1 9 14.996z" />
      <circle cx="12" cy="12" r="10" />
    </>
  ),
  // [circle-pause]
  "circle-pause": (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="10" x2="10" y1="15" y2="9" />
      <line x1="14" x2="14" y1="15" y2="9" />
    </>
  ),
};

/*
 * THE FILLED TWINS.
 *
 * A filled/outline pair is two drawings of one object, not paint poured into
 * an outline (which turns an open-stroke glyph into a blob). Each twin here is
 * built from its outline's own geometry in three layers:
 *
 *   body  closed shapes, painted solid AND stroked at the family weight, so
 *         the silhouette's outer edge lands exactly where the outline's does.
 *   cut   detail knocked OUT of the body at the same weight (a door, a tick, a
 *         fold), through an SVG mask, so the detail stays the family's line
 *         and not a hand-traced hole that thins at small steps.
 *   keep  strokes drawn on top as ordinary lines (a bell's clapper, a mast).
 *
 * `cut` children default to strokes; give one `fill="black"` to cut a solid
 * hole. A name with no twin ignores `filled` and draws its outline, so a call
 * site can never ship a blob.
 */
type FilledTwin = { body: React.ReactNode; cut?: React.ReactNode; keep?: React.ReactNode };

const SHIELD =
  "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z";
const HOUSE_BODY =
  "M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z";

const FILLED: Partial<Record<UiIconName, FilledTwin>> = {
  /* VC1: the call controls' solid twins. A slash is cut a little below
     and right of the line it keeps, so the solid body shows a clean gap. */
  video: {
    body: (
      <>
        <rect x="2" y="6" width="14" height="12" rx="2" />
        <path d="M16 10.5l5.248-3.062A.5.5 0 0 1 22 7.87v8.196a.5.5 0 0 1-.777.416L16 13z" />
      </>
    ),
  },
  "video-off": {
    body: (
      <>
        <rect x="2" y="6" width="14" height="12" rx="2" />
        <path d="M16 10.5l5.248-3.062A.5.5 0 0 1 22 7.87v8.196a.5.5 0 0 1-.777.416L16 13z" />
      </>
    ),
    cut: <path d="m3.5 1.5 20 20" />,
    keep: <path d="m2 2 20 20" />,
  },
  mic: {
    body: <rect x="9" y="2" width="6" height="13" rx="3" />,
    keep: (
      <>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <path d="M12 19v3" />
      </>
    ),
  },
  "mic-off": {
    body: <rect x="9" y="2" width="6" height="13" rx="3" />,
    cut: <path d="m3.5 1.5 20 20" />,
    keep: (
      <>
        <path d="M16.95 16.95A7 7 0 0 1 5 12v-2" />
        <path d="M18.89 13.23A7 7 0 0 0 19 12v-2" />
        <path d="M12 19v3" />
        <path d="m2 2 20 20" />
      </>
    ),
  },
  "phone-missed": {
    body: <path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384z" />,
    keep: <path d="m16 2 6 6M22 2l-6 6" />,
  },
  "phone-incoming": {
    body: <path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384z" />,
    keep: <path d="M16 2v6h6M22 2l-6 6" />,
  },
  "phone-outgoing": {
    body: <path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384z" />,
    keep: <path d="m16 8 6-6M22 8V2h-6" />,
  },
  volume: {
    body: <path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z" />,
    keep: <path d="M16 9a5 5 0 0 1 0 6M19.364 18.364a9 9 0 0 0 0-12.728" />,
  },
  home: {
    body: <path d={HOUSE_BODY} />,
    cut: <path d="M10.5 21.5v-6a1.5 1.5 0 0 1 3 0v6z" fill="black" />,
  },
  house: {
    body: (
      <>
        <path d={HOUSE_BODY} />
        <path d="M16.5 5.14V3.5a.5.5 0 0 1 .5-.5h1.5a.5.5 0 0 1 .5.5v3.78" />
      </>
    ),
    cut: <path d="M10.5 21.5v-6a1.5 1.5 0 0 1 3 0v6z" fill="black" />,
  },
  /* No `search` twin, on purpose: a solid lens reads as a dot on a stick at
     20px, and every platform in the references keeps the magnifier open when
     its tab is selected. The pill and the colour carry the state. */
  /* Two solid cards, each with a line of text cut out of it, so the capsule
     shows through (the dock's solid cutout set, B1 second ruling). */
  feed: {
    body: PATHS.feed,
    cut: <path d="M7 6.75h6M7 17.25h6" />,
  },
  "search-disc": {
    body: <circle cx="12" cy="12" r="9.5" />,
    cut: (
      <>
        <circle cx="11.25" cy="11.25" r="3.5" />
        <path d="m16 16-2.25-2.25" />
      </>
    ),
  },
  grid: {
    body: PATHS.grid,
  },
  user: {
    body: (
      <>
        <circle cx="12" cy="7" r="4" />
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2z" />
      </>
    ),
  },
  bed: {
    body: (
      <>
        <path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4z" />
        <path d="M2 18v-6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v6z" />
      </>
    ),
    cut: <path d="M12 4.5v5M4.5 10h15" />,
    keep: <path d="M2 18v2M22 18v2" />,
  },
  "chat-bubble": { body: PATHS["chat-bubble"] },
  heart: { body: <path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5z" /> },
  star: { body: PATHS.star },
  crown: {
    body: <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />,
    keep: <path d="M5 21h14" />,
  },
  "house-heart": {
    body: <path d={HOUSE_BODY} />,
    cut: <path d="M8.62 13.8A2.25 2.25 0 1 1 12 10.836a2.25 2.25 0 1 1 3.38 2.966l-2.626 2.856a.998.998 0 0 1-1.507 0z" fill="black" />,
  },
  bookmark: { body: PATHS.bookmark },
  bolt: { body: PATHS.bolt },
  moon: { body: <path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401z" /> },
  phone: { body: <path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384z" /> },
  bell: {
    body: <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326z" />,
    keep: <path d="M10.268 21a2 2 0 0 0 3.464 0" />,
  },
  location: {
    body: <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0z" />,
    cut: <circle cx="12" cy="10" r="2.5" fill="black" stroke="none" />,
  },
  verified: { body: <path d={SHIELD} />, cut: <path d="m9 12 2 2 4-4" /> },
  "shield-stop": { body: <path d={SHIELD} />, cut: <path d="M9 12h6" /> },
  ticket: {
    body: <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />,
    cut: <path d="M13 5v2M13 11v2M13 17v2" />,
  },
  "calendar-booking": {
    body: <rect x="3" y="3.5" width="18" height="18" rx="2" />,
    cut: <path d="M3 9.5h18M9 15.5l2 2 4-4" />,
    keep: <path d="M8 2v3M16 2v3" />,
  },
  document: {
    body: <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />,
    cut: <path d="M14 2v5a1 1 0 0 0 1 1h5M10 9H8M16 13H8M16 17H8" />,
  },
  "price-tag": {
    body: <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />,
    cut: <circle cx="7.5" cy="7.5" r="1.5" fill="black" stroke="none" />,
  },
  wallet: {
    body: <path d="M3 5a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v3h1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2z" />,
    cut: (
      <>
        <path d="M3 5a2 2 0 0 0 2 2h14" />
        <path d="M21.5 12H18a2 2 0 0 0 0 4h3.5" />
      </>
    ),
  },
  key: {
    body: <circle cx="7.5" cy="15.5" r="5.5" />,
    cut: <circle cx="7.5" cy="15.5" r="1.5" fill="black" stroke="none" />,
    keep: (
      <>
        <path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4" />
        <path d="m21 2-9.6 9.6" />
      </>
    ),
  },
  compass: {
    body: <circle cx="12" cy="12" r="10" />,
    cut: (
      <path
        d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z"
        fill="black"
      />
    ),
  },
  map: {
    body: <path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z" />,
    cut: <path d="M15 6.5v13M9 4.5v13" />,
  },
  info: {
    body: <circle cx="12" cy="12" r="10" />,
    cut: <path d="M12 16v-4M12 8h.01" />,
  },
  block: {
    body: <circle cx="12" cy="12" r="10" />,
    cut: <path d="M4.929 4.929 19.07 19.071" />,
  },
  picture: {
    body: <rect width="18" height="18" x="3" y="3" rx="2" />,
    cut: (
      <>
        <circle cx="9" cy="9" r="2" fill="black" />
        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
      </>
    ),
  },
  mail: {
    body: <rect x="2" y="4" width="20" height="16" rx="2" />,
    cut: <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" />,
  },
  flag: {
    body: <path d="M4 15.5V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528z" />,
    keep: <path d="M4 22v-7" />,
  },
  eye: {
    body: <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z" />,
    cut: <circle cx="12" cy="12" r="3" />,
  },
  /* THE BOLD PASS'S TWINS (29 September 2026). Solid bodies for the glyphs a
     row or a chip can hold in a selected state, cut on the same rules. */
  sun: {
    body: <circle cx="12" cy="12" r="4" />,
    keep: <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />,
  },
  briefcase: {
    body: <rect width="20" height="14" x="2" y="6" rx="2" />,
    cut: <path d="M8 6v14M16 6v14" />,
    keep: <path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />,
  },
  parking: {
    body: <rect width="18" height="18" x="3" y="3" rx="2" />,
    cut: <path d="M9 17V7h4a3 3 0 0 1 0 6H9" />,
  },
  kitchen: {
    body: <path d="M5 6a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6Z" />,
    cut: <path d="M5 10h14M15 6v1.5M15 12.5v3" />,
  },
  droplet: { body: PATHS.droplet },
  certificate: {
    body: <circle cx="12" cy="8" r="6" />,
    keep: <path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526" />,
  },
  stamp: {
    body: (
      <>
        <path d="M14 13V8.5C14 7 15 7 15 5a3 3 0 0 0-6 0c0 2 1 2 1 3.5V13z" />
        <path d="M20 15.5a2.5 2.5 0 0 0-2.5-2.5h-11A2.5 2.5 0 0 0 4 15.5V17a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1z" />
      </>
    ),
    keep: <path d="M5 22h14" />,
  },
  survey: {
    body: (
      <>
        <path d="M17 7.5c0 3.2-3.6 6-4.6 6.8a.7.7 0 0 1-.8 0C10.6 13.5 7 10.7 7 7.5a5 5 0 0 1 10 0z" />
        <rect x="2" y="17" width="20" height="5" rx="1" />
      </>
    ),
    cut: (
      <>
        <circle cx="12" cy="7.5" r="1.5" fill="black" stroke="none" />
        <path d="M6 17v2M10 17v2M14 17v2M18 17v2" />
      </>
    ),
  },
};

/**
 * THE SIZE SCALE: 12, 16, 20, 24, 28, 32 on a 4px grid, plus 40 for display.
 *
 * 12 left the scale once, on the argument that a stroked glyph on a 24 grid
 * renders a 0.7 CSS pixel line at 12px. That was true of a FIXED
 * `strokeWidth`, and it had already been fixed: `strokeWidth` is computed per
 * size (`uiIconStrokeWidth` below), so 12px renders a real 1.5 CSS px line
 * rather than a hairline. 12 is also the second most requested size in the product
 * (35 of 197 explicit call sites when counted), so it came back.
 * `docs/ICON_SYSTEM.md` carries the longer account.
 */
export const UI_ICON_SIZES = [12, 16, 20, 24, 28, 32, 40] as const;
export type UiIconSize = (typeof UI_ICON_SIZES)[number];

/** Nearest step, ties to the larger. Clamped to the ends of the scale. */
export function snapUiIconSize(size: number): UiIconSize {
  let best: UiIconSize = UI_ICON_SIZES[0];
  let bestGap = Number.POSITIVE_INFINITY;
  for (const step of UI_ICON_SIZES) {
    const gap = Math.abs(step - size);
    if (gap <= bestGap) {
      best = step;
      bestGap = gap;
    }
  }
  return best;
}

/**
 * The same scale, named: all seven steps, nothing off the scale. When the
 * scale changes, COUNT the entries rather than adjusting this sentence.
 */
export const ICON_SIZE = { "2xs": 12, xs: 16, sm: 20, md: 24, lg: 28, xl: 32, display: 40 } as const;
export type IconSize = keyof typeof ICON_SIZE;

/**
 * THE WEIGHT. One weight, expressed as rendered CSS pixels rather than as a
 * number on the 24 grid. `strokeWidth` is in viewBox units, so a fixed number
 * renders thinner the smaller the glyph; the grid number is derived from the
 * size instead, and every stroked glyph on the platform renders this many CSS
 * pixels at every step. 2.25 is the bold, even line of the founder's
 * 29 September target (pump.fun's app icons, about 2 to 2.25 at 24), a
 * quarter over the weight Lucide's geometry is drawn for. It was 1.5 until
 * then, the thin line of SF Symbols regular, which read as hesitant beside
 * the bold type. `LineGlyph` and `SettingsGlyph` are name maps onto this
 * set (since 29 September 2026), so both follow the set's weight.
 *
 * SCALED BY SIZE, OPTICALLY. One fixed pixel weight at every step clogs the
 * small steps (2px on a 12px glyph is a third of a counter) and starves the
 * display step; one fixed grid number does the opposite. The rendered line
 * therefore steps with the size, on quarter pixels so it lands on the device
 * grid at 2x: 1.5 at 12, 1.75 at 16, 2.25 at 20 and 24 (the reference),
 * then a quarter more per step to 3 at 40.
 *
 * RAISED TO 2.25 AT 20 AND 24 (the ICONS3 audit, 29 September 2026). At 2
 * the nav, dock and detail-row glyphs still read a shade lighter than
 * pump.fun's beside 600-weight labels; the founder's "a bit more bold" is the
 * top of the 2 to 2.25 range those icons draw. 12 and 16 stay where they
 * were, because a heavier line there closes Lucide's counters.
 */
export const UI_ICON_STROKE_PX = 2.25;

export const UI_ICON_STROKE_BY_EDGE: Record<UiIconSize, number> = {
  12: 1.5,
  16: 1.75,
  20: UI_ICON_STROKE_PX,
  24: UI_ICON_STROKE_PX,
  28: 2.5,
  32: 2.75,
  40: 3,
};

/**
 * The `strokeWidth` (in 24-grid units) that renders the set's weight at a
 * rendered edge of `size` CSS px. Any size is accepted: the weight comes from
 * the nearest step and the grid number from the true size, so an off-scale
 * glyph still draws the family's line.
 */
export function uiIconStrokeWidth(size: number): number {
  return (UI_ICON_STROKE_BY_EDGE[snapUiIconSize(size)] * 24) / size;
}

/**
 * THE LEAN WEIGHT (29 September 2026, the founder: "inner icons like settings
 * icons, profile icons, saved, agreements ... don't make them bold like side
 * nav and bottom nav, make them clean, lean and neat").
 *
 * Two weights, one family. The bold line above belongs to the NAVIGATION
 * CHROME only: the bottom dock and its menu, the side rail and drawer, every
 * `NavTree`, the admin rail (`app/css/symbols.css` lists the scopes). Every
 * other glyph, the rows, cards, chips and buttons inside a page, draws this
 * lean line: SF Symbols regular territory, a third lighter than the chrome,
 * so the navigation reads as the strong frame and the content stays calm.
 */
export const UI_ICON_LEAN_BY_EDGE: Record<UiIconSize, number> = {
  12: 1.25,
  16: 1.4,
  20: 1.6,
  24: 1.7,
  28: 1.85,
  32: 2,
  40: 2.25,
};

export function uiIconLeanStrokeWidth(size: number): number {
  return (UI_ICON_LEAN_BY_EDGE[snapUiIconSize(size)] * 24) / size;
}

export type UiIconWeight = "lean" | "bold";

/**
 * The stroke props every stroked glyph in the family spreads onto its <svg>.
 * The attribute carries the lean line (what renders anywhere CSS has not
 * loaded); the two custom properties let `app/css/symbols.css` switch a glyph
 * to the bold line inside the navigation chrome without a prop at every call
 * site. `weight` pins one glyph either way, whatever it sits in.
 */
export function uiIconStrokeProps(size: number, weight?: UiIconWeight) {
  const lean = uiIconLeanStrokeWidth(size);
  const bold = uiIconStrokeWidth(size);
  return {
    strokeWidth: weight === "bold" ? bold : lean,
    "data-nf-weight": weight,
    style: { "--nf-sw-lean": lean, "--nf-sw-bold": bold } as React.CSSProperties,
  };
}

/**
 * Symbol effects: a class, not a prop-driven animation, so it costs nothing
 * when unused and every one of them collapses under prefers-reduced-motion
 * (`app/css/symbols.css`).
 */
export type SymbolEffect = "bounce" | "pulse" | "wiggle" | "rotate" | "fly";

/** Every name in the set, in drawing order. The icon gallery reads this. */
export const UI_ICON_NAMES = Object.keys(PATHS) as UiIconName[];

/** Whether `filled` changes this glyph, rather than being ignored. */
export function uiIconHasFill(name: UiIconName): boolean {
  return FILLED[name] !== undefined;
}

export function UiIcon({
  name,
  size = ICON_SIZE.sm,
  className,
  label,
  effect,
  /** Plays the effect continuously rather than once on mount or on hover. */
  effectLoop,
  filled,
  weight,
}: {
  name: UiIconName;
  /** Pins the line weight; by default the glyph follows where it sits. */
  weight?: UiIconWeight;
  /** A step on the scale, or its name. Anything else snaps onto the nearest. */
  size?: number | IconSize;
  className?: string;
  /** Accessible name. Omit when a text label sits beside the glyph. */
  label?: string;
  effect?: SymbolEffect;
  /** Repeats the effect three times and rests (not forever; principle 10). */
  effectLoop?: boolean;
  /**
   * Draws the glyph's filled twin: a selected tab, a saved heart, a rated
   * star. Ignored for a name with no twin (see FILLED above).
   */
  filled?: boolean;
}) {
  const reactId = useId();
  const edge = snapUiIconSize(typeof size === "number" ? size : ICON_SIZE[size]);
  /* One id per rendered icon for the twin's mask. The name and edge are in it
     so an id can never point at another glyph's or another size's mask, even
     if two ids collided; `useId` is stable across server and client render,
     so hydration never disagrees about it. Stripped to characters a
     `url(#...)` reference takes unescaped. */
  const maskId = `nf-ui-${name}-${edge}-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const twin = filled ? FILLED[name] : undefined;
  return (
    <svg
      width={edge}
      height={edge}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      {...uiIconStrokeProps(edge, weight)}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={[
        "nf-ui-icon",
        effect ? `nf-sym nf-sym--${effect}` : "",
        effect && effectLoop ? "nf-sym--loop" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ") || undefined}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {twin ? (
        <>
          <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
            <g fill="white" stroke="white">
              {twin.body}
            </g>
            {twin.cut ? (
              <g fill="none" stroke="black">
                {twin.cut}
              </g>
            ) : null}
          </mask>
          <rect width="24" height="24" fill="currentColor" stroke="none" mask={`url(#${maskId})`} />
          {twin.keep}
        </>
      ) : (
        PATHS[name]
      )}
    </svg>
  );
}
