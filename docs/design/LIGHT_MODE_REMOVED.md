# Light mode, removed on 23 September and restored on 25 September

> **This whole document is history. Light mode ships today.** It came back on 25 September 2026 (Track E): a complete light palette in the `:root[data-theme="light"]` block of `packages/design-tokens/src/tokens.css` and in `apps/web/src/app/css/light.css`, a dark ground behind the logo and the role-switch coin, glass objects standing alone on white with a soft blue shadow (the founder chose that over the dark tile they first sat on), anything over a photograph kept dark, and a Light / Dark / System control at the foot of the side navigation and in Settings (default Dark, `apps/web/src/lib/theme/theme.ts`). The causes this document records are answered in `docs/research/LIGHT_MODE_SURVEY.md`; both themes are swept at 390px by `apps/web/scripts/design/light/sweep.mjs`.
>
> The scripts this history names under `scripts/design/` (`compare-surface.mjs`, `no-light/`) were removed on 17 October 2026: they checked a single-theme product that no longer exists. Recover them from git history if ever needed.

> **Money, as of 17 October 2026.** Vallo never holds customer money. A wallet, escrow or held payment kept by Vallo itself was retired on 25 September 2026 (Track A), and where this document describes one it describes the past. Since ADR 0003 a licensed partner may hold a payment in escrow, offered only while `protectedRailLive()` reads it as working. The current truth is [`docs/MONEY_ARCHITECTURE.md`](/docs/MONEY_ARCHITECTURE.md).

**Founder decision, 23 September 2026.** Light mode is removed from the
platform. This is the record of what came out, what was struck with it, and the
handful of things deliberately left behind with the reason for each.

Session A led it because it is the token layer. Session B follows in its seven
surfaces; the note telling it the floor was laid is `docs/archive/BUILD_07_LEDGER.md`
section 49, R11.

---

## 1. The one line that actually turns this on

```css
html {
  color-scheme: dark;
}
```

`apps/web/src/app/css/base.css`, unlayered, beside the other element defaults.

**Deleting a palette does not stop a light operating system.** The browser does
not take its cue for the things it draws ITSELF from a stylesheet's custom
properties. It takes them from `color-scheme`, whose initial value is `normal`,
meaning "follow the user". Without this line, on a phone set to light, the
following go white inside a dark page and no CSS in this repository can reach
any of them:

- the inside of a `<select>` when it is open
- a native date and time picker
- the spin buttons on a number input
- the background Chrome paints over an autofilled field
- a checkbox and a radio that keep their native appearance
- the scrollbars and the text caret
- the canvas the browser flashes before the first paint

`dark` rather than `only dark`: `only dark` additionally opts out of the
browser's own automatic adjustments, which has never been needed here. What
matters is that `light` is not in the list at all, so a user agent set to light
has nothing to honour.

## 2. What came out

### The tokens

`packages/design-tokens/src/tokens.css`: the entire `:root[data-theme="light"]`
block, **932 lines**. A complete second palette with its own canvas, elevation
ladder, edge ladder, glass, state colours and inks.

Also deleted from the night block, because their only consumer was daylight:
`--nf-icon-ground`, `--nf-icon-ground-edge`, `--nf-icon-plate`. That closes
L-60, which asked for the brand object's blend mode, plate token and plate class
to go once the glass artwork was wired: the blend mode went first, the night
plate second, the daylight plate now.

`CHROME_COLOUR` in `apps/web/src/lib/theme/chrome.ts` was a record keyed on a
theme and is one string.

### The stylesheets

`apps/web/src/app/css/light.css` is **deleted**, and its `@import` is out of
`globals.css`. Not left unimported: an unimported stylesheet is a stylesheet
somebody imports again.

**42 `[data-theme="light"]` rule blocks** removed from seventeen partials in
`apps/web/src/app/css/`. Found by walking brace depth rather than by grepping a
list, and each removed with the comment block sitting immediately above it,
because a comment with nothing but whitespace between it and a deleted rule is
by construction about that rule. `catalogue.css` alone held 72 mentions inside
3 blocks.

### The attribute writer

`apps/web/src/app/layout.tsx`: the before-paint script that read `nf_theme`
from storage and set `data-theme="light"` on the root element, plus the
`theme-color` meta it rewrote. **Nothing can set the attribute any more**, which
is what makes every light rule still standing in another session's partition
dead code rather than a live half-state.

`viewport.themeColor` is now the only writer of the chrome colour: on the
server, once.

### The control

`apps/web/src/components/site/ThemeToggle.tsx` is deleted, with its three call
sites: the side drawer's bare glyph (`AppRail`), the desktop site header, and
the mobile menu's Display group. The Appearance card's theme row
(`SettingsGroups`) and the settings hub's appearance row (`SettingsHub`) are
deleted.

Removed rather than pinned to Dark. A control with one value is not a control,
and a setter that still exists is a setter somebody gives a second value back
to.

### The machinery

This is the part that matters, and it is the part a "hide the toggle" change
would have left behind.

| what | where |
|---|---|
| `applyTheme`, `applyThemeColour`, `readThemeChoice`, `ThemeChoice` | `components/app/account/settings-store.ts` |
| the `nf_theme` storage key | same |
| the `useSyncExternalStore` subscription and its cross-tab `storage` listener | same |
| the `MutationObserver` on `data-theme` that repainted the native status bar | `lib/native/theme.ts`, **file deleted** |
| two more `MutationObserver`s that swapped map tiles | `components/app/price/PinMap.tsx`, `components/app/search/MapCanvas.tsx` |
| a Tailwind variant keyed on `html[data-theme=light]` | `components/app/ResultSheet.tsx` |

### The artwork switch, which is the least obvious of these

`BrandIcon` rendered **two** `<Image>` elements for the 23 objects that had a
separately drawn daylight twin, and a `display` rule keyed on the theme chose
between them. That shape existed because the theme was an attribute on the
document element rather than an OS preference, so `<picture>` and
`prefers-color-scheme` could not see it, and swapping `src` in an effect would
have flickered the mark on the confirmation screens where it is the emotional
payload.

It renders one file now. `LIGHT_TWINS`, the `data-twinned` attribute and the
day and night classes are gone. `.nf-brand-icon-ground` keeps only its
geometry: square, squircle corner, seven per cent of room, and the lit rim that
three surfaces ask for by name.

### The light half of the checking tools

`apps/web/scripts/probe-contrast.mjs` loses `--themes` **rather than defaulting
it**. A flag that still accepted "light" would run a whole sweep, find nothing
wrong, and hand back a clean report about a theme that does not exist, and a
report that cannot be told apart from a passing one is worse than no report. It
now emulates an operating system set to LIGHT on every route it opens, so the
sweep re-proves `color-scheme: dark` as a side effect of measuring anything
else.

`apps/web/scripts/check-css-tokens.mjs` loses the `DULL_ALLOWED` exception that
excused a light switch rule that no longer exists. A spent exception is an
assertion about a rule nobody can read, which is the fault family that script
exists for.

## 3. What was struck

- **The 121 light twins owed.** `docs/archive/FOUNDER_ARTWORK_NEEDED.md` was a render
  order for daylight versions of brand objects. Kept with a STRUCK banner
  rather than deleted, because two things in it are facts about the ARTWORK and
  survive the theme: the pack splits into 80 objects sliced from the supplied
  sheets and 41 cropped out of the reference renders at 36 to 56 pixels of
  native size, and no filter gets from one of these objects to a light version
  because the difference is which parts are TRANSPARENT.
- **The 49 daylight contrast failures.** A whole-harness sweep on the day of the
  decision measured 60 below the floor in light, on 5,264 text-bearing leaves
  across 136 routes. That number is now about a theme that does not ship.
- **The two daylight measuring tools.** Kept at the time because they showed
  that compositing these PNGs offline is a model of what Chromium paints, mean
  1.41 of 255. Removed on 13 October 2026 with the glass PNGs they read; the
  finding stands as recorded here.

## 4. What was deliberately left, and why

- **`apps/web/public/brand/glass/light/**`.** 23 daylight PNGs, now referenced
  by nothing. They are commissioned artwork and deleting them is not a
  session's call. `brand-icon-assets.test.ts` asserts the directory is intact
  AND unreferenced, so the next reader cannot file it as a wiring bug and
  nobody can wire it back without the test saying so.
- **`escrow-hold`** stays withheld in that directory for its own, separate
  reason: `docs/BRAND_MARKS.md` says build it and do not ship it until escrow
  exists, because `lib/legal/terms.tsx` states that Vallo does not hold your
  money.
- **`data-theme="dark"` markers** on the permanently dark auth shell
  (`app/(auth)/layout.tsx`) and the first-run stage
  (`components/app/welcome/WelcomeStage.tsx`), and on `app/global-error.tsx`.
  The dark palette is declared on `:root, [data-theme="dark"]`, so these still
  resolve; they are now redundant rather than wrong, and both of the first two
  are outside this session's partition.
- **`uiCommon.theme` in `packages/i18n`.** Four locales of strings with no
  reader. Deleting locale keys is governed by a separate rule about i18n
  ownership, and an unread string is not a mechanism that can be switched back
  on.
- **`lib/email/**` IS UNTOUCHED, by the founder's ruling.** Emails keep their
  own palette, their `color-scheme: dark` meta and their
  `prefers-color-scheme: dark` block exactly as designed. Gmail strips that
  query and runs its own inversion regardless, which is the reason those files
  were built the way they were. Nothing in this removal went near them.

## 5. Still to do, in other partitions

Every `:root[data-theme="light"]` rule in a file this session does not own is
now **dead code**: the attribute it keys on can no longer appear. Nothing is
broken by leaving it and nothing is fixed by leaving it.

Session A has since cleared the four general stylesheets that belong to no
surface as well: `settings-rows.css`, `side-nav.css`, `social.css` and
`social-feed.css`. `docs/archive/SESSION_B_SCOPE.md` names `social.css` among the files
Session B never edits and does not claim the other three.

What is left, measured with the comment-stripped check below rather than with a
grep:

| file | live rules | whose |
|---|---|---|
| `app/css/price-check.css` | 15 | the price-check worker |
| `app/css/escrow.css` | 4 | the escrow worker |
| `app/css/admin.css`, `app/css/wallet.css`, `app/css/auth.css`, `app/css/inspection.css` | Session B's partition | Session B |
| `app/welcome/welcome.css`, `app/admin/_review/review.css`, `app/admin/money/_desk/desk.css` | Session B's partition | Session B |
| `scripts/design/compare-surface.mjs` | its `--twin-sweep` has nothing left to find | whoever owns it |

Both of the first two are filed with their exact selectors in
`docs/archive/BUILD_07_LEDGER.md` section 49, R12, so nobody has to re-derive the list.

**HOW TO CHECK, AND IT IS NOT A GREP.** After a removal like this most hits for
the string are comments explaining that the thing is gone, including ones that
say so in those words: a plain search reported fourteen files of which eight
were prose. `scripts/design/no-light/live-light-rules.mjs` blanks `/* */`
and `//` first, then looks for the selector, prints file and line, and exits
non-zero if anything is live. It refuses to report a clean result if it read
zero files, because the first version of it pointed one directory too high and
printed a confident pass over nothing.

## 6. The proof

`scripts/design/no-light/prove-no-light.mjs`, run against a production
build with the OS preference forced to light. See section 7 for the run.
