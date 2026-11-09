# Share cards, the pump.fun control family, and the Apple-style icons

Founder brief of 9 November 2026, consolidated so one frontend owner can take
it to a clean, finished state. The reference is the pump.fun share surface and
the iOS App Store tab bar. Everything here is translated into Vallo's own
identity: royal blue (never pump.fun green or purple), our mark, no copied
branding, no long forwarded links.

"Done clean" means: wired into the real screens (not just a harness), both
themes, 320 to desktop with no overflow, type-check and all guards green,
screenshots taken and the rough edges fixed, copy in the locale files.

## 1. The share card (the centrepiece)

What exists already (lead built the pieces; build on them, do not re-create):

- `components/share/ShareComposer.tsx`: the composer: a brand share card, a
  row of background presets, show-on-card toggles, and the two bottom pills
  ("Background", "Share"). Harness: `/preview/features/share`, `?kind=listing`.
- `app/css/share.css`: the card, the pills, and the brand aurora backgrounds
  (`.nf-aurora--glow/brand/ink`).
- `components/ui/MediaPill.tsx`: the control family below.

To finish:

1. **Open it from the real Share controls**, in a bottom `Sheet`
   (`components/ui/Sheet.tsx`), so tapping Share opens the composer, not the
   bare OS sheet:
   - Profile: `components/social/profile/ProfileShare.tsx`. Subject: handle,
     name, avatar, two public stats, url `/u/<handle>`.
   - Roommate listing: the share control on `/roommates/r/[id]`. Subject: the
     cover photo as a background preset, the title, rent / your-share /
     rooms-free stats, url `/roommates/r/<id>`.
   - Roommate profile, and a Circle post where a share control exists.
   - Public fields ONLY: no private profile fields, no exact address, no
     preferences. Reuse each screen's real data.
2. **The forwarded preview**: upgrade `app/s/[token]/opengraph-image.tsx`
   (and/or `components/share/og-share-card.tsx`) so the image a link unfurls to
   is the same design as the in-app card (brand ground, avatar, headline,
   stats, the Vallo mark). The link stays short: `/s/<token>` or
   `/u/<handle>`: never a long query-string link.
3. **Fill the card** so it never looks empty: with a real avatar or cover it is
   full; for a profile with no photo, show the tinted initials tile, not a gap.
4. **Card variants** worth adding (pump.fun's tabs were Callout / Profit /
   Multiple): a simple tab row on the composer to switch what the card leads
   with: e.g. a profile's "match %", a listing's "your share a month", a
   group's "spaces left". Keep it to the data we actually have.

## 2. The MediaPill control family (use it widely)

`components/ui/MediaPill.tsx` is the pump.fun "Background" button: a capsule
that leads with a round piece of media (a face, a photo, a colour swatch), a
label, an optional sub-label, and a trailing chevron / value / toggle. It is a
blessed capsule in the shape guards (`PILL_ALLOWED`, `DULL_ALLOWED`).

The founder wants it "in many places, some as toggles or swipes". Adopt it, as
a button or as a `pressed` toggle, in at least these spots (add more where it
reads well):

- a background / theme picker,
- an account or profile switcher,
- a "change cover" / "change photo" control,
- a filter-summary pill that shows the active filter inside itself,
- the saved-collection picker.

Register any genuinely new capsule you introduce in `PILL_ALLOWED` with a
one-line reason. Do not turn ordinary rectangle buttons into capsules; the
capsule is the picker/selector signal only.

## 3. The Apple-style icons (done by lead, adopt them)

- `search` is redrawn to the App Store magnifier's proportions. No call-site
  change needed; it updates everywhere.
- `stack` is a new glyph: the App Store "Apps" tab's layered-cards look. Use it
  for collections, libraries and "all of X" entries: the saved hub, a
  community list, the side-nav entry for a collection. Keep the other nav
  glyphs as they are.

## 4. The watermark (done by lead)

`ChatWatermark` behind a quiet assistant / messages thread is smaller and more
present now. No further work unless a screenshot shows it off.

## 5. Mine the pump.fun surface for more (recommend, then build)

From the pump.fun screenshots, the patterns worth having in our style, for the
kind of platform we are (property, roommates, community):

- **Background presets with a "Yours / Presets" split**: let a lister use one
  of their own listing photos as the card background, or a Vallo preset.
- **A crop / darken control** on a photo background (pump.fun's "Framing" +
  "Darken 40%"), so text always holds over a busy photo.
- **"Show on card" toggles** (already in the composer): keep them to the
  fields that exist.
- **A share card for a wins moment**: "Found a place", "Matched", "Group is
  full", "Verified": a celebration card a member can share, in our voice and
  within the claims rules (nothing unbacked).

Propose the shortlist in your report before building the extra ones, so the
founder picks.

## Guardrails (all of the above)

No em dashes. Plurals through `plural()`. Copy in the locale files. The claims
guard (`lib/trust/claims.ts`) applies to every shareable string. Type-check
before each commit, keep the shape and motion guards green, honour reduced
motion. Screenshot both themes and fix what looks off before reporting.
