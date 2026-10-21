import Image from "next/image";
import { brandArtwork, type TieredObjectName } from "./object-assets";

/**
 * Vallo brand icon.
 *
 * NO BRANDICON DRAWS GLASS (the founder, 7 October 2026: "Remove all glass
 * icons on the entire platform"). The names below are still the vocabulary a
 * call site speaks, but each one now draws a SOLID object: the tiered render
 * of the same name where there is one, else the solid object
 * `glass-to-solid.ts` chose for its meaning (tier B, tier A, or the founder's
 * 3D sheet). The history below is about the glass pack and is kept so the
 * next reader knows why the files are still on disk.
 *
 * The content tier: one object per thing the product talks about. A shield, a
 * villa, a receipt. Navigation is `UiIcon`: the side drawer, the rail, the
 * dock and its More tray all draw line glyphs since 29 September 2026 (the
 * Track M glass map they once read is deleted). The two
 * tiers never share a row. In light, outside a night island, every object
 * stands on a navy tile (`app/css/light.css`); a host that draws its own
 * plate opts out with `data-host-plate`.
 *
 * THE ARTWORK CHANGED, AND IT IS THE REASON THIS FILE IS SHORTER THAN IT WAS.
 *
 * Until now the pack was soft matte white clay on white plinths, rendered as
 * opaque RGB with no alpha channel. The white had to be removed at paint time
 * with `mix-blend-mode: multiply`, and multiply against the night canvas
 * returns the night canvas, so every untiled object needed a near-white plate
 * painted behind it just to be visible. On the default theme that made every
 * content object on the platform a white sticker on navy: an app icon pasted
 * into a list row. Three of them in a column on `/bookings` were the clearest
 * example, and `/rent` showed two at once.
 *
 * `public/brand/glass` is the replacement: 103 objects in the logo's own
 * language, cut from the supplied sheets with a brightest-channel alpha key
 * rather than a brightness threshold, so the glow IS the alpha ramp and there
 * is no edge to see. They composite correctly on the navy canvas, on a card,
 * and on paper. So the blend mode is gone, the dark plate is gone, and
 * `.nf-brand-icon-ground` now paints nothing at all in the dark theme. That
 * was the acceptance test for the swap and it passed: see `docs/ICON_SYSTEM.md`
 * and `docs/archive/FRONTEND_REVAMP.md` section 2.
 *
 * WHAT IS STILL TRUE, AND IT IS SIMPLER THAN IT WAS. A glass object is
 * see-through by design, so its interior alpha is partial, and that is correct
 * against the dark ground this platform has. It read thin on white paper,
 * which is why the light theme gave the untwinned objects a navy plate and
 * gave 23 marks a separately drawn daylight twin instead.
 *
 * LIGHT MODE WAS REMOVED ON 23 SEPTEMBER 2026 AND RESTORED ON 25 SEPTEMBER.
 * The removal deleted the plate tokens, the twin `<Image>`, the `LIGHT_TWINS`
 * set and the day and night classes, and none of them came back:
 * `.nf-brand-icon-ground` is a square wrapper with a radius and a little
 * padding and nothing else. The restored light theme styles the objects in
 * `app/css/light.css` ("THE ICON TILES"): no ground, a soft blue drop shadow
 * and an edge fade, so the object stands alone on white.
 *
 * The one fact from that work worth carrying forward, because it is about the
 * ARTWORK and not about a theme: no filter gets from one of these objects to a
 * paper version of it. The difference is which parts of the object are
 * transparent, and a frosted-white mark keyed off white inverts on a dark
 * ground. If a second palette is ever wanted, it is a render order.
 *
 * THE TILE IS OFF BY DEFAULT, and it used to be on.
 *
 * `tile` defaulted to true, so almost every call site drew a full glass chip
 * inside an `.nf-card` that already carried a gradient border, a rim and an
 * elevation shadow: two containers deep, six visual layers, around one 24px
 * icon. A tile is now something a surface asks for, and the answer is usually
 * no. Ask for it where the object is the SUBJECT rather than an ornament. An
 * icon beside a heading, inside a button, in a list row or on a stat tile does
 * not get one. Nothing in the tree asks for one today, and the 23 transaction
 * marks must never be given one, because they arrive on their own rounded
 * glass tile and a tile around a tile is the nested chrome this platform has
 * been removing.
 */

/**
 * The 144 objects that exist as files under `public/brand/glass`. This list is
 * the artwork, not a wish: it is generated from the directory, so a name that
 * is here has a PNG and a name that is not cannot be typed.
 *
 * Alphabetical rather than grouped. The previous list was split into "actions
 * and concepts" and "property types" with a long comment between them, and the
 * split stopped being true the moment the transaction marks arrived: a receipt
 * is neither. One order that a reader can search beats three groups that have
 * to be maintained.
 *
 * FORTY ONE OF THESE ARE CROPPED FROM THE REFERENCE RENDERS, not sliced from
 * a sheet, on the direction's ruling that a glass object a governing render
 * uses and the sheets lack is cropped, keyed and filed under a name. They are
 * recorded in `docs/ICON_SYSTEM.md`, which lists them. Two things
 * to know at a call site. They are single objects with no light twin, so in
 * daylight they take the navy chip like the other 80. And they are NOT all
 * drawn at the same size: the wallet and the hotel are around 200 pixels at
 * source, the tiles 56 to 84, the landing rings and chips 36 to 48, so a
 * `-ring` or `-chip` belongs in a 24 to 48 slot and not in an empty state.
 * The manifest's `native` field says which is which.
 */
export const BRAND_ICONS = [
  "alert-triangle",
  "apartment-block",
  "bank-column",
  "beach-house",
  "bed-ring",
  "bell-badge",
  "bell-tile",
  "bill-tile",
  "booking-instant",
  "bookmark-ribbon",
  "bot",
  "brain-chip",
  "brain-ring",
  "building-chip",
  "bungalow",
  "calendar-check",
  "calendar-clock",
  "calendar-grid",
  "calendar-home",
  "calendar-ring",
  "calendar-time",
  "camera",
  "card-lock",
  "card-tile",
  "chart-growth",
  "chart-ring",
  "chat-duo",
  "chat-ring",
  "city-ring",
  "clock-check",
  "clock-expired",
  "cluster-home",
  "coin-naira",
  "concierge-bell",
  "container-home",
  "contract-sign",
  "coworking-space",
  "doc-cross",
  "doc-home",
  "doc-lock",
  "doc-review",
  "doc-shield",
  "duplex",
  "farm-house",
  "flip-coin",
  "gift",
  "gift-star",
  "globe",
  "globe-chip",
  "globe-pin",
  "guest-house",
  "headset",
  "heart-home",
  "home-check",
  "home-lock",
  "home-ring",
  "home-search",
  "hotel",
  "hotel-bed",
  "hotel-room",
  "hotel-star",
  "hourglass",
  "house-boat",
  "id-card-check",
  "info",
  "inspect-ring",
  "key-cycle",
  "key-ring",
  "keys-handover",
  "keys-home",
  "keys-tag",
  "lake-house",
  "land-plot",
  "ledger-book",
  "listing-search",
  "loft",
  "luggage-check",
  "luggage-plane",
  "manage-ring",
  "mansion",
  "map-route",
  "map-spot",
  "mini-flat",
  "modern-house",
  "mountain-cabin",
  "naira-coins",
  "naira-hand",
  "office-space",
  "palette",
  "palm-tree",
  "payment-failed",
  "payment-received",
  "payment-sent",
  "penthouse",
  "people-ring",
  "person-card",
  "phone-tile",
  "pin-map",
  "progress-ring",
  "receipt-check",
  "report-stats",
  "reviews",
  "role-switch-tile",
  "savings-pot",
  "seal-check",
  "seal-cross",
  "seal-pending",
  "search-home",
  "search-ring",
  "send-plane-tile",
  "serviced-apartment",
  "serviced-block",
  "shared-apartment",
  "shield-check",
  "shield-check-tile",
  "shield-home",
  "shield-lock",
  "shield-ring",
  "shop-retail",
  "shortlet",
  "stays-hotel-palms",
  "studio-apartment",
  "support-chat",
  "support-shield",
  "tag-hash",
  "tag-percent",
  "terrace-house",
  "tour-360",
  "townhouse",
  "transfer-arrow",
  "tree-house",
  "twin-house",
  "user-check",
  "user-verified",
  "villa",
  "wallet",
  "wallet-chip",
  "wallet-naira",
  "wallet-out",
  "wallet-plus",
  "wallet-ring",
  "wallet-secure",
  "wallet-tile",
  "warehouse",
] as const;

/** A name with a file behind it. */
export type BrandIconObject = (typeof BRAND_ICONS)[number];

/*
 * THE 23 LIGHT TWINS ARE NO LONGER DRAWN, AND THE SET THAT NAMED THEM IS GONE.
 *
 * `LIGHT_TWINS` held the transaction and outcome marks that shipped a second,
 * separately drawn PNG for daylight under `public/brand/glass/light`. This
 * component rendered BOTH files and a `display` rule keyed on
 * `[data-theme="light"]` chose between them. The founder removed light mode on
 * 23 September 2026, so the attribute can never appear, the second `<Image>`
 * could never be shown, and rendering a hidden copy of 23 objects is a cost
 * with no outcome.
 *
 * THE FILES ARE STILL ON DISK AND THAT IS DELIBERATE. `glass/light/**` is
 * commissioned artwork; deleting it is the founder's call, and it is
 * inert where it sits because nothing references it. `brand-icon-assets.test.ts`
 * records that it is retained and unused so the next reader does not file it as
 * a wiring bug. `escrow-hold` stays withheld there for its own, separate
 * reason: `docs/BRAND_MARKS.md` says build it and do not ship it until escrow
 * exists, because `lib/legal/terms.tsx` states that Vallo does not hold your
 * money.
 *
 * `docs/design/LIGHT_MODE_REMOVED.md` is the record.
 */

/**
 * Names the clay pack had and the glass pack does not, kept as aliases onto
 * the object that replaces them.
 *
 * SEVEN NAMES, AND THEY ARE A MIGRATION SHIM RATHER THAN A DESIGN.
 *
 * Fourteen clay names have no glass equivalent. Seven of them were never drawn
 * anywhere outside the inventory in this file, so they are simply gone:
 * `cleaning`, `home-cam`, `home-refresh`, `home-swap`, `parking-space`,
 * `swimming-pool` and `phone-home`. The seven below are drawn on real screens
 * across files this one does not own, so deleting the name would have been a
 * compile error in somebody else's work rather than a substitution. The
 * alias means every one of those screens gets the correct new artwork today,
 * and the rename can follow as a separate, readable change.
 *
 * Each substitution is the one `docs/archive/FRONTEND_REVAMP.md` section 2.6 argues
 * for. Two of them, `homes-sparkle` and `house-sparkle`, are marked interim
 * there: no glass object carries "several homes, recommended" or "one home,
 * recommended", and those two are the only objects on the list that need
 * commissioning. `cluster-home` and `modern-house` are the honest stand-ins,
 * not the answer.
 */
const LEGACY_ALIASES = {
  /* The alert is a state, and `state="alert"` already carries it. */
  "bell-alert": "bell-badge",
  /* One bubble against two is not a distinction any screen is making. */
  chat: "chat-duo",
  /* Both bot variants collapse: use `hero/hero-assistant-*` where the idea is
     needed at size, which is a scene and not an icon. */
  "bot-chat": "bot",
  "bot-home": "bot",
  /* A listing as a document. `doc-review` is the one for "under review". */
  "listing-review": "doc-home",
  /* Interim. Both of these need commissioning: see the note above. */
  "homes-sparkle": "cluster-home",
  "house-sparkle": "modern-house",
} as const satisfies Record<string, BrandIconObject>;

/** Every glass name a call site may pass, including the seven deprecated aliases. */
export type BrandIconName = BrandIconObject | keyof typeof LEGACY_ALIASES;

/**
 * What the `BrandIcon` component itself accepts: a glass name, or one of the
 * accepted two-tier objects of 6 October 2026 (`prepaid-meter`, `padlock`,
 * `trophy`...). `BrandIconName` stays the glass vocabulary on purpose: the line
 * twin map in `glass-to-line.ts` and the empty-state kit are keyed on it, and a
 * new object has no line twin to invent.
 */
export type BrandIconProp = BrandIconName | TieredObjectName;

function resolveObject(name: BrandIconProp): BrandIconObject {
  return name in LEGACY_ALIASES
    ? LEGACY_ALIASES[name as keyof typeof LEGACY_ALIASES]
    : (name as BrandIconObject);
}

/**
 * What a name draws (7 October 2026, the founder: no glass anywhere). The
 * legacy alias is resolved first, then `brandArtwork` in `object-assets.ts`
 * picks the tiered render of the same name where one exists, else the solid
 * object `glass-to-solid.ts` chose. It never returns a `/brand/glass/` path.
 */
function resolveArtwork(name: BrandIconProp) {
  return brandArtwork(name, resolveObject(name));
}

export function BrandIcon({
  name,
  size = 56,
  fill,
  drawn,
  label,
  priority,
  loading,
  tile = false,
  state,
  className,
}: {
  name: BrandIconProp;
  /** Rendered edge length in px. Ignored when `fill` is set. */
  size?: number;
  /** Fill the parent box so a wrapper can size the icon responsively. */
  fill?: boolean;
  /**
   * SPEED-5: with `fill`, the wrapper's largest drawn edge in CSS px. It
   * becomes the image's `sizes`, so the optimiser serves a file the size the
   * icon is drawn at (1x and 2x of it) instead of the generic fill hint
   * `(max-width: 640px) 26vw, 160px`, which sent a 384px file to a phone for
   * a 16px chip. Leave it out where the wrapper really is fluid.
   */
  drawn?: number;
  /** Accessible name. Omit for decorative icons. */
  label?: string;
  priority?: boolean;
  /**
   * "eager" for an icon that mounts off screen and slides in (the drawer).
   * iOS Safari fetches a lazy image only once layout puts it in the
   * viewport, and a transform-only slide-in never re-triggers that check, so
   * the drawer's icons were never requested and its rows drew blank.
   */
  loading?: "eager" | "lazy";
  /**
   * Draw the chip (`.nf-icon-tile`) behind the object. OFF by default: see the note
   * at the top of this file. Turn it on only where the object is the subject
   * of the surface rather than an ornament on it.
   */
  tile?: boolean;
  /**
   * React to something real rather than to a loop: "alert" rings the object
   * while something is unread, "confirmed" pops it once when a booking lands.
   * ("verified" pulsed a box-shadow and no caller used it; gone, round 5.)
   *
   * IT ONLY WORKS WITH `tile`, AND THE COMPONENT DOES NOT SAY SO ANYWHERE ELSE.
   *
   * `data-state` is written by the TILED branch at the bottom of this file and
   * by nothing else, and every rule that reads it in glass.css is scoped to
   * `.nf-icon-tile`. `tile` defaults to `false`. So a call that passes `state`
   * without also passing `tile` is accepted by the type, rendered without the
   * attribute, and does nothing at all - no error, no warning, no visible
   * difference from not having passed it.
   *
   * That is F2-025, and it is still open. The finding was expected to close
   * itself when `MomentScreen` was deleted, on the basis that it was the only
   * caller. It was not: `app/(app)/listing/[id]/ReservePanel.tsx` passes
   * `state="confirmed"` on the booking-requested mark, without `tile`, so the
   * one confirmation pop the component exists to give is the one thing that
   * does not happen there.
   *
   * The prop is therefore NOT dead and was not removed with the moment screen.
   * Two honest ways out, neither of them this workstream's to take alone:
   * the call site adds `tile`, or the untiled branch learns `data-state` and
   * `.nf-brand-icon-ground[data-state]` gains the three rules - which is new
   * motion on a money surface and a design decision rather than a cleanup.
   */
  state?: "alert" | "confirmed";
  /**
   * @deprecated No effect. It asked for the render over the glass original
   * (the space types row, 7 October 2026); later that day the founder ruled
   * out glass everywhere, so the render is now what every BrandIcon draws.
   * Kept so existing call sites compile; drop it when you touch one.
   */
  preferRender?: boolean;
  className?: string;
}) {
  const decorative = !label;
  const { src, material, object } = resolveArtwork(name);

  /*
   * `fill` here means "fill the wrapper box", implemented with intrinsic
   * dimensions plus width and height of 100 percent rather than Next's
   * absolute fill mode. Absolute fill escapes any wrapper that is not
   * positioned, which silently spills icons across the card they belong to.
   *
   * WHY A FIXED-SIZE TILE OVERRIDES ITS OWN PADDING. The tile is styled with
   * `padding: 9%`, and a percentage padding resolves against the width of the
   * CONTAINING BLOCK, never against the element's own width. When the tile
   * fills a sized wrapper that is harmless, because the wrapper is the same
   * small box. But a `size`d tile sitting directly in something wide, a button
   * or a flex row, resolved 9% against that wide parent: a 22px chip inside a
   * 330px button was handed roughly 30px of padding per side, which crushed its
   * content box to zero and rendered a 0 by 0 image. The result was an empty
   * white chip, which is exactly what "Add New Listing" on the agent dashboard
   * was showing, and it affected every non-fill BrandIcon on the platform.
   *
   * So when this component owns the tile's dimensions it also owns its padding,
   * in pixels derived from that size. Same proportion, no dependence on whatever
   * the tile happens to sit inside.
   */
  const tilePadding = Math.max(2, Math.round(size * 0.09));
  const groundPadding = Math.max(1, Math.round(size * 0.07));
  const shared = {
    "aria-hidden": decorative || undefined,
    width: fill ? (drawn ?? 160) : size,
    height: fill ? (drawn ?? 160) : size,
    sizes: fill ? (drawn ? `${drawn}px` : "(max-width: 640px) 26vw, 160px") : undefined,
  } as const;

  /*
   * ONE FILE, ONE ELEMENT. It used to be two: the dark artwork and, for the 23
   * twinned marks, a second `<Image>` of the daylight artwork, with a
   * `display` rule keyed on `[data-theme="light"]` choosing between them. That
   * shape existed because the theme was an attribute on the document element
   * rather than an OS preference, so `<picture>` and `prefers-color-scheme`
   * could not see it and swapping `src` in an effect would have flickered the
   * mark on the confirmation screens where it is the emotional payload.
   *
   * Light mode was removed on 23 September 2026 and the second element went
   * with it. Worth keeping from that note, because it is the reason the hidden
   * copy was affordable at the time and the reason a future two-artwork switch
   * should be built the same way: a lazy image inside a `display: none`
   * ancestor is never fetched, measured in Chromium 1194 rather than assumed.
   */
  const img = (
    <Image
      {...shared}
      alt={label ?? ""}
      src={src}
      priority={priority}
      {...(loading && !priority ? { loading } : {})}
      className="nf-brand-icon h-full w-full"
    />
  );

  if (!tile) {
    /*
     * The ground hugs the image rather than being sized here: the artwork
     * carries its own transparent margin, between 5 and 14 percent on the
     * single objects, so the chip reads as a plate with the object breathing
     * inside it and needs no padding of its own. Sizing stays wherever the
     * call site already put it.
     *
     * In the dark theme this paints NOTHING. `--nf-icon-ground` is transparent
     * there now, which is the whole point of the new artwork, and the element
     * survives only because the light theme still wants a navy chip behind the
     * 80 objects that have no light twin.
     */
    /*
     * `data-object` REACHES THE DOM AND `data-twinned` NO LONGER DOES.
     *
     * The pair existed so a MIXED SET could be seen: 23 objects shipped a
     * daylight twin and 121 did not, and in daylight those were two different
     * materials standing side by side, a pale frosted mark beside dark artwork
     * on a navy plate. It happened in at least six places and nothing could
     * check it, because the fact lived in a `Set` in this file and never
     * reached the markup. A browser sweep was written at the time to walk a
     * real page and report any container holding both.
     *
     * Light mode was removed on 23 September 2026 and there is one artwork
     * family again, so the distinction the attribute carried does not exist and
     * the sweep has nothing to find. `data-object` stays: it is one string on
     * an element that already exists, nothing styles it, and it is what lets a
     * browser check say WHICH object a plate is drawing rather than guessing
     * from a filename.
     */
    return (
      <span
        data-object={object}
        /* `data-material` is the hook the light theme keys the ground plate on:
           the matte and realistic objects stand on the paper plate (radius 14,
           about 4 percent brand fill, soft blue contact shadow) and NOT on the
           navy chip the glass needs. See north star 14.7 and the rule in the
           report that accompanies this change. */
        data-material={material}
        /* The ground owns its box and its padding in pixels when it has a
           size, for the reason the tiled branch below does: `padding: 7%`
           in glass.css resolves against the CONTAINING block, so a 22px
           object inside a wide button was handed a padding that crushed the
           image to nothing, and in light, where the ground paints a navy
           tile, that showed as an empty tile ("Add New Listing"). The box
           is the object PLUS its padding, so the object itself still draws
           at exactly `size` and nothing already laid out around it shrinks. */
        style={
          fill
            ? undefined
            : {
                width: size + 2 * groundPadding,
                height: size + 2 * groundPadding,
                padding: groundPadding,
              }
        }
        className={`nf-brand-icon-ground ${
          fill ? "block h-full w-full" : "inline-flex"
        } ${className ?? ""}`}
      >
        {img}
      </span>
    );
  }

  return (
    <span
      data-state={state}
      data-material={material}
      style={fill ? undefined : { width: size, height: size, padding: tilePadding }}
      className={`nf-icon-tile ${fill ? "h-full w-full" : ""} ${className ?? ""}`}
    >
      {img}
    </span>
  );
}
