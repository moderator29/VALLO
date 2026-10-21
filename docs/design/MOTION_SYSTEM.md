# The Vallo motion system

**Written 6 October 2026; section 0 rewritten to the system as built on
17 October 2026 (Agent D audit).** Section 0 is the reference a session
builds against: the token names, the patterns and where each lives. Sections
1 and 2 are the principles and the moment inventory, still in force. Section
3 is history (D68c). Code comments cite these section numbers, so they stay.

---

## 0. The system as built

One motion language, in CSS, in the token file
(`packages/design-tokens/src/tokens.css`). No GSAP and no Three.js in the
product bundle; framer-motion is installed but the product's motion is CSS and
the Web Animations API. Animate `transform` and `opacity` only
(`app/css/no-layout-motion.test.ts` holds it).

### Durations

| Token | Value | Use |
|---|---|---|
| `--nf-duration-instant` | 90ms | a state flip with no travel |
| `--nf-duration-press` | 120ms | press feedback, inside the time a finger is down |
| `--nf-duration-fast` | 160ms | state changes: chips, toggles, crossfades, skeleton to content |
| `--nf-duration-pop` | 180ms | the payoff pop (principle 5), the heart |
| `--nf-duration-base` | 240ms | layout and sheets: tab change, sheet exit, toast, list arrival |
| `--nf-duration-slow` | 380ms | scenes: route transition, sheet entry |
| `--nf-duration-entrance` | 520ms | a card entering on scroll |
| `--nf-duration-deliberate` | 620ms | figures counting, a chart drawing, a payment confirmed |
| `--nf-duration-cinematic` | 900ms | the rare brand moment |

Settings, Appearance, Motion (`lib/motion/motion-pref.ts`, `app/css/motion-pref.css`)
rescales the ladder: `cinematic` about a quarter longer, `calm` shorter with
loops stopped after one pass, `off` lands every animation in its final state.

### Easings

| Token | Curve | Designer's name | Use |
|---|---|---|---|
| `--nf-ease-entrance` | `cubic-bezier(0.16, 1, 0.3, 1)` | land | every enter |
| `--nf-ease-exit` | `cubic-bezier(0.4, 0, 1, 1)` | leave | every exit |
| `--nf-ease-standard` | `cubic-bezier(0.22, 0.61, 0.36, 1)` | glide | crossfades, figures, charts |
| `--nf-ease-spring` | `cubic-bezier(0.34, 1.28, 0.64, 1)` | drift | the low-bounce settle: sheets, the dock pill, toggles |
| `--nf-ease-whip` | `cubic-bezier(0.7, 0, 0.2, 1)` | whip | a fast flick: a form error's shake |
| `--nf-ease-press` | `cubic-bezier(0.3, 0, 0.2, 1)` | | press, leaves at once and eases back |

`lib/motion/ease.ts` holds the same curves for JavaScript-driven motion.

### Stagger

| Token | Value | Use |
|---|---|---|
| `--nf-stagger` | 40ms | cards, rows, sections arriving together |
| `--nf-stagger-tight` | 20ms | things read as one: odometer digits, the route's first rows |
| `--nf-stagger-cap` | 5 | the index cap: the seventh arrives with the sixth |

```css
.nf-feed-lead {
  animation: nf-feed-stagger var(--nf-duration-base) var(--nf-ease-entrance) both;
  animation-delay: calc(min(var(--nf-i, 0), var(--nf-stagger-cap)) * var(--nf-stagger));
}
```

The index is data (`--nf-i`, `--card-i`, written by the list), never an
`nth-child` ladder, and a list staggers on first paint only (the wrapper's key
is the item id, so a like or a refresh never replays it).

### Press

`--nf-press-scale-sm` 0.94 (icon buttons), `--nf-press-scale` 0.97,
`--nf-press-scale-lg` 0.985 (cards and heroes), `--nf-press-sink` 1px, all at
`--nf-duration-press` on `--nf-ease-press` (`app/css/press-motion.css`).

### Reduced motion

Under `prefers-reduced-motion: reduce` every duration token is 1ms, both
stagger tokens are 0ms, spring and whip are linear, the press scales are 1 and
the route shifts are 0, in `:root` and in every night subtree. So a rule that
reads the tokens needs no reduced-motion branch of its own. Where a moment
must still say where it came from, the reduced cut is a 160ms opacity fade
written out (`app/css/route-motion.css`, `threshold.css`), because the tokens
have collapsed there. Ambient loops sit behind `LoopGate` and
`useMotionGate` (off screen, hidden tab, reduced motion, data saver: stopped).

### Patterns and where they live

| Pattern | Where |
|---|---|
| Route transition, grows from the tapped element, folds back on Back | `RouteTransition`, `lib/motion/nav-origin.ts`, `nav-direction.ts`, `app/css/route-motion.css` |
| Page stagger on arrival | `.nf-page-stage` in `route-motion.css` |
| Sheet up from the bottom with a scrim, drag to dismiss | `components/ui/Sheet.tsx` |
| Press feedback | `app/css/press-motion.css`, `lib/motion/press-start.ts` |
| Chip and segment select pop | `lib/motion/select-pop.ts`, `components/ui/Segmented.tsx` |
| Figures counting once, odometer per digit | `CountUp`, `components/ui/Odometer.tsx`, `lib/motion/odometer.ts` |
| Scroll entry for cards | `Reveal`, `useInView`, `lib/motion/scroll-entry.ts` |
| Photo open from its thumbnail | `lib/motion/photo-morph.ts` |
| Skeleton to content crossfade | `.nf-fade-swap` in `app/css/motion-kit.css` |
| The startup hold and the door | `components/startup`, `ThresholdStage`, `lib/motion/threshold.ts` |
| Payoff pop | `--nf-duration-pop`, `SuccessMoment`, `SuccessSheet` |

### Adding motion

1. Use a pattern above before writing a new one; a new moment goes in the
   inventory (section 2) in the same commit.
2. Durations, easings and stagger are tokens. A literal is allowed only for an
   ambient loop measured in seconds or for the reduced-motion fade.
3. Transform and opacity only.
4. No money figure animates before the server confirms it (section 2, Money).
5. Check it under reduced motion and under Settings, Motion, Calm.

### What was decided on 6 October and still holds

GSAP stays out of the product bundle (about 70KB gzipped on budget Android over
Nigerian networks; `scripts/check-weight.mjs` holds the budget). Three.js is
refused for the product; the 3D feeling comes from pre-rendered assets moved
with CSS 3D transforms. The designer's five curves map to the tokens above.

---

## 1. The principles

From the designer's brief, adopted in full. These are the rules a session is judged
against.

1. **Every element has intent.** Nothing moves without a reason. Motion answers where
   something came from, what changed, or how far along it is.
2. **Entrances are fast, exits are slower.** `whip` and `land` in, `leave` and `drift`
   out. This is counter-intuitive and it is correct: arriving should feel decisive,
   leaving should feel unhurried.
3. **Stagger children `--nf-stagger` (40ms) apart, `--nf-stagger-tight` (20ms)
   for things read as one.** It should read as one organism, not a queue. At
   most six items; the seventh arrives with the sixth (`--nf-stagger-cap`).
4. **Depth through parallax.** Background layers move at **0.6x** foreground speed.
5. **Payoff moments get one sharp impact and a subtle pop**: scale 1.0 to 1.04 to 1.0
   over 180ms, plus one haptic. Confirm, verify, unlock, release, earn. **Nothing else
   in the product is allowed to pop**, which is what keeps the payoff meaningful.
6. **Transform and opacity only.** Never animate layout, width, height, top or left.
7. **Deterministic.** Seeded variation where organic variety is wanted, never a raw
   random call, so a sequence looks the same on every run and can be tested.
8. **Reduced motion and data saver are features.** Everything collapses to instant or a
   160ms fade; blur drops to a solid surface.
9. **Nothing blocks interaction.** A person can always tap through an animation.
10. **Nothing loops forever** except the aurora and the assistant's thinking state.

---

## 2. The moment inventory

Every moment in the product, with its curve and duration. Session 3 builds against
this table.

### Entry and brand

| Moment | Spec |
|---|---|
| **App open** | Section 3. 1,500ms, once per cold start, skippable |
| **Get Started entrance** | Section 4 |
| **Route transition** | Grows from the tapped element's origin via `nav-origin`, folds back on Back. `land` 380ms |
| **Tab change** | Crossfade plus a 12px lift, `glide` 240ms |
| **Threshold: door** | After verify. Existing `ThresholdStage` |
| **Threshold: leave** | On sign-out. Existing |

### Figures and data

| Moment | Spec |
|---|---|
| **Figure arrival** | Counts from zero, `glide` 620ms, once per mount, never re-counting on re-render |
| **Odometer change** | Per digit, `land` 380ms, staggered 20ms left to right, only changed digits move |
| **Chart draw** | Line path draws `glide` 620ms; bars grow from baseline staggered 30ms |
| **Chart morph between periods** | Path interpolates `glide` 380ms |
| **Progress ring** | Sweeps `glide` 620ms |

### Controls

| Moment | Spec |
|---|---|
| **Press** | Sink 1px, `press` 120ms, bloom pulls in |
| **Primary action morph** | Rectangle to circle to tick. `whip` 160ms out, `land` 240ms into the tick, then the payoff pop |
| **Segmented pill** | Springs to the chosen segment, `drift` 240ms. Content crossfades `glide` 160ms |
| **Toggle** | `drift` 240ms |
| **Dock pill** | Springs to the tapped slot `drift` 240ms, arriving before the route |
| **Chip select** | Scale 1.0 to 1.03, `land` 160ms |

### Surfaces

| Moment | Spec |
|---|---|
| **Sheet entry** | Rises from below with `land` 380ms while the scrim blur ramps 0 to 12 |
| **Sheet exit** | `leave` 240ms |
| **Card entry on scroll** | 50 to 90px vertical float with overhang offset, `land` 520ms, children staggered `--nf-stagger` |
| **Card press** | Scale 0.985, `press` 120ms |
| **List stagger** | First six only, 40ms apart, 12px lift and fade |
| **Skeleton to content** | Crossfade `glide` 160ms. Never a spinner |
| **Modal backdrop** | Blur fade `glide` 240ms |

### Payoff moments, which alone may pop

| Moment | Spec |
|---|---|
| **Payment confirmed** | Full-screen tick scales in over a radial wash, `land` 620ms, then the pop and one haptic |
| **Escrow released** | The same, with the amount counting up after the tick lands |
| **Verification passed** | Shield assembles, tick embosses, pop |
| **Badge or streak earned** | Sunburst behind the medal, `drift` 620ms, pop, then the share affordance rises |
| **Referral code revealed** | Ticket unfolds, dashed border draws, code lands. `land` 520ms |
| **Agreement approved** | Timeline fills to the final step, pop on the last node |

### Money, where motion must never mislead

| Moment | Spec |
|---|---|
| **Processing steps** | Each step ticks **when it actually completes**, never on a timer |
| **Balance change** | Odometer, and **only after the server confirms**. A balance never animates optimistically |
| **Held to released** | The held state crossfades to released `glide` 380ms, with the figure moving between columns |

**The hard rule: no money value may animate in a way that implies money moved when it
did not.** An optimistic animation on a failed payment is a lie told in motion.

### Content and feed

| Moment | Spec |
|---|---|
| **Photo open** | Shared-element zoom from the tapped thumbnail via `photo-morph` |
| **Gallery swipe** | Follows the finger, `drift` settle on release |
| **Favourite toggle** | Heart scales 1.0 to 1.2 to 1.0, `land` 240ms, with a haptic |
| **Pull to refresh** | The brand mark rotates with the drag and spins once on release |
| **Map pin drop** | Falls 12px and settles `drift`; the selected pin lifts |
| **Story progress** | Linear, honest to the real duration |

### States

| Moment | Spec |
|---|---|
| **Empty state** | The clay object settles in `drift` 520ms, then the copy fades |
| **Toast** | Rises 16px with a leading tick, `land` 240ms in, 2,400ms dwell, `leave` 160ms out |
| **Form error** | The field shakes 4px once, `whip` 160ms, message fades in beneath. Never a dialog |
| **Status change** | Label, colour and shape crossfade together `glide` 240ms |
| **Pro unlock** | The gated surface lifts 8px and its veil dissolves, `land` 380ms, then one pop |

---

## 2b. Principles adopted on 7 October 2026 (the founder's motion script)

One focal action at a time; everything else holds still. Objects stay alive across
screens and transform rather than being replaced: a card becomes the page it opens, a
figure becomes the receipt's figure, a pin becomes the map. Easing settles without
bounce. Motion carries meaning (grouping, order, cause, scale), never decoration. The
reduced-motion cut keeps the same sequence of ideas. Colour is never the only signal; no
flashes. Source: `docs/design/references/2026-10-07/README.md`, "The motion explainer
prompt".

## 3. The startup sequence

> **Superseded on 7 October 2026 (D68c, D71).** The logo opening described below is
> retired. The logo never appears by itself on app open. The native launch image is a
> plain `#010118` field, the native splash is hidden from the first script in the
> document through the raw bridge, and the opening is the page arriving: header and
> dock in frame one, content rising with at most 60ms of stagger, about 1,500ms on the
> first open and 400ms on a returning one, a tap settling it at once. The code is
> `components/startup/startup-script.ts`; the tests that hold the rule are
> `StartupOpening.dom.test.tsx` and `startup-css.test.ts`. What follows is history.

**The founder reports the logo screen currently sits for about eight seconds. The
target is 1.5 seconds of intentional, animated brand, then the product.**

### Root-cause first, because this is the whole point

**The eight seconds is not an animation duration. It is an unbounded network call.**
`app/open/route.ts` calls `resolveSession()` with no deadline, so the splash holds
until Supabase answers. **Session 2 fixes that before Session 3 builds this.** An
animation over an unbounded call is a longer hang with better production values, and
the founder's own instruction is that the fix must not be a timer.

### The sequence, 1,500ms

| Time | Beat | Curve |
|---|---|---|
| 0 to 120 | Navy ground, matching the native splash exactly so the handoff is invisible | none |
| 120 to 480 | The mark assembles: facets arrive from depth and lock, rotating 12 degrees to 0, scaling 0.86 to 1 | `land` |
| 380 to 720 | Wordmark letters arrive from depth, 24ms apart, blur 6 to 0 | `glide`, stagger 24ms |
| 640 to 900 | The edge light sweeps the lockup once, left to right | `glide` |
| 900 to 1,150 | The lockup settles and breathes once, scale 1.0 to 1.02 to 1.0 | `drift` |
| 1,150 to 1,500 | The door opens: the ground parts and Get Started is revealed beneath | `leave` |

**Use `BrandAssemble` and `DepthWords`, which already exist**, before writing anything
new. They were built for this.

**Rules.** Once per cold start, gated on sessionStorage and the native shell. **Tap to
skip at any point.** A 160ms crossfade under reduced motion. Inline, nonce-carrying and
CSS-only in the root layout so it never waits on a JavaScript chunk. The native splash
hides on first paint so the two never fight. `lib/motion/threshold.ts` gains an `open`
kind beside `door` and `leave`.

**If the app is ready before 1,500ms, the sequence still completes**, because a brand
moment cut short looks broken. **If it is not ready by 1,500ms, the sequence holds on
the settled lockup with the breath continuing**, and that is the only honest waiting
state. It never pretends to finish.

**Prerequisite: the vector mark.** A 614px raster scaled and rotated will be visibly
soft on a 3x screen, on the one screen that forms a first impression.

---

## 4. Get Started: the deep reference

Founder directive D13 made this monotone and the first screen after the animation,
which makes it **the most seen screen in the product**. This section is its full
specification.

**It is a reference, not a copy.** Vallo's version has more motion than anything the
references show.

### The composition

One screen, no scroll on a phone, four layers of depth:

| Layer | Content | Parallax |
|---|---|---|
| **4, furthest** | A very soft radial ground wash, one hue, almost invisible | 0.3x |
| **3** | A slow aurora drift, the existing one, heavily damped | 0.45x |
| **2** | The mark, small, top | 0.6x |
| **1, front** | The display line, the quiet line, the doors | 1.0x |

**Monotone.** One hue, no secondary colour, no glow, no gradient beyond the ground
wash. **The doors are the only contrast on the screen.**

### The entrance, 900ms after the door opens

| Time | Beat | Curve |
|---|---|---|
| 0 | Inherits the startup's final frame with the mark already in position. **No re-entrance of the mark**: it is continuous, and that continuity is the premium detail | |
| 0 to 240 | The ground wash blooms from the mark outward | `glide` |
| 120 to 520 | The display line arrives from depth, blur 4 to 0, lifting 16px | `land` |
| 240 to 620 | The quiet line fades and lifts 8px | `glide` |
| 420 to 780 | The primary door arrives from below, 24px, with its bloom settling behind it | `land` |
| 480 to 840 | The secondary door follows, staggered 60ms | `land` |
| 840 to 900 | The primary breathes once, 1.0 to 1.02 to 1.0 | `drift` |

### Alive, not animated

The screen must feel like it is breathing rather than playing a loop.

- **The aurora drifts continuously**, very slowly, never repeating visibly thanks to
  seeded variation.
- **The primary door has a slow bloom pulse**, 4 seconds, barely perceptible, enough
  that the eye registers the screen as live.
- **Device tilt**, where the sensor allows, moves the layers by their parallax ratios
  at most 6px. **Off under reduced motion and off on data saver.**
- **Nothing else moves** until touched.

### Pull and touch

- **Pull down** past the top stretches the ground wash and the mark by 0.6x the drag,
  settling on `drift` release. The brand rewards curiosity and does nothing else.
- **Press on a door** sinks 1px with its bloom pulling in, `press` 120ms.
- **Release into the flow** morphs the pressed door into the next screen's origin via
  `nav-origin`, so the route grows out of the thing that was tapped.

### Prohibited here specifically

No carousel. No phone mock. No feature list. No social proof, because there is none
yet that is true. No looping video. No more than one route onward besides sign in.
**Nothing that would make this screen need scrolling on a phone.**

---

## 5. The other surfaces the designer named

**Pro and premium areas.** The unlock moment is a payoff: the gated surface lifts 8px
and its veil dissolves `land` 380ms, then one pop and one haptic. **The Pro switch
itself is absent for a member without entitlement**, so there is nothing to animate for
them. Never animate a locked state invitingly: that is an advertisement pretending to
be an interface.

**Cards.** Scroll-driven reveal with overhang offset and a 50 to 90px float, `land`
520ms, children staggered 60ms. Press sinks 0.985. Favourite toggles with a scale pop
and a haptic. The move-in total counts up when the card first enters, once.

**Bottom sheets and modals.** Spring entry from below `land` 380ms, backdrop blur
ramping 0 to 12 in parallel, exit `leave` 240ms. The grabber follows the finger on a
drag and settles on `drift`.

**Search to results.** The search pill morphs into the results header, the filter chips
cross-fade, and results stagger in at 40ms. **The morphing pill is the signature of
this transition** and it is worth the care.

**The landing page.** Layered motion with the 0.6x parallax ratio, scroll-driven
section reveals, figures counting up as they enter, and the capsule edge light running
continuously. **Restraint: a serious venture-backed product, not an over-designed
template.**

**The wallet.** The balance odometer only after server confirmation. The held-to-
released crossfade. The withdrawal confirm morph. **Money motion is the most
conservative in the product**, because here a misleading animation is a lie.

---

## 6. The passcode screen

**The founder's assessment: it is bad right now.** It is also the screen a returning
member sees more than any other, which makes it the highest-frequency surface in the
product.

**Four digits by default** per D18, with six still offered.

**What it becomes.** The ground is quiet and monotone, matching Get Started so the two
feel like one family. A small mark at the top, then a short line naming who is signing
in. **The dots are the subject of the screen**, large and generously spaced, not a
cramped row.

**The motion is the whole thing here:**

- **Each digit lands** with a scale pop 1.0 to 1.15 to 1.0 on its dot, `land` 160ms,
  plus one light haptic. This is the single most repeated interaction in the product,
  so it must feel good on the thousandth repetition.
- **The keypad keys** sink on press, `press` 120ms, with a soft bloom.
- **A wrong code shakes** the dot row 6px once, `whip` 160ms, and the dots clear with a
  `leave` fade. **No red flash and no dialog.** The message appears quietly beneath.
- **The correct code** fills the last dot, holds 80ms, and **the door opens** into the
  app using the same threshold as the startup sequence, so unlocking and launching feel
  like the same gesture.
- **Biometric, where available**, is offered first and the keypad is the fallback, with
  the prompt rising on `land` 240ms.

**Never:** a spinner after the last digit, a red screen, a shaking dialog, a count of
remaining attempts shown before the final one, or a delay that is not real.

---

## 7. What is still open

Built: every token in section 0, the moment inventory's controls, surfaces,
lists, figures and payoff moments, reduced motion and the Motion setting.
Not yet measured: dropped frames on the feed, the gallery and the sheets on a
throttled mid-range Android (needs a device; see the audit report). The
startup timings are owned by `components/startup` and its tests.
