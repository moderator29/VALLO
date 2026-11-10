# The 16 October upgrade: containers, deep transitions, more motion

The founder, 16 October 2026, with five pump.fun App Store images as the
blueprint:

> I need those pop op containers I circle the way it's but in our own brand
> identity the kind of container and tick edges it have I need them in the
> films I need more transition in the films like deep transition and also I
> need the films to be entirely upgrade!! Like so fucking slick think more
> deep more components moves more stuffs ... industry standard motion films
> ... make it A1

Three things, in this order of importance.

## 1. Deep transitions at every chapter boundary

Each film is a run of chapters, and each chapter opens its own `ground(...)`.
Where one ground ends and the next begins is a cut, and today most of those
cuts are nothing at all. Put ONE transition on each, from `kit.js`:

```js
slabWipe(ctx, t, { dir: "left" | "right" | "up" | "down", dur: 0.42 })
shutter(ctx, t, { bars: 7, dur: 0.4 })
irisTicks(ctx, t, { dur: 0.46 })      // four tick brackets close and bloom
tileFall(ctx, t, { cols: 6, rows: 10 })
whipPan(ctx, t, { dir: "left", dur: 0.26 })   // light only: pairs with a pose move
```

`t` is the cut itself: the frame where the stage is covered (or, for
`irisTicks`, at its tightest). Put it on the frame the next ground starts.

Rules:
- never the same transition twice in a row, and no transition more than four
  times in one film;
- `whipPan` is a light touch, for a quick move inside a chapter, not for a
  chapter change;
- `tileFall` and `shutter` are the loud ones: at most two each per film, and
  never over a sentence of voice that lands mid-transition;
- keep `flash(...)` where the film already uses it for a beat INSIDE a
  chapter; replace it only where it was standing in for a cut.

## 2. The pop-out container where the film holds something up

```js
popOut(ctx, parent, {
  kind: "line" | "stat" | "cells" | "counters",
  x, y,            // its CENTRE on the stage
  t0, t1,          // in and out
  size,            // the type's base size: 34 on the phone cut, 28 on desktop
  from: "below" | "above" | "left" | "right",
  tab: "Move-in total",     // the label astride the top rule (uppercased)
  tone: "dark" | "day",     // "day" on the white stages ONLY
  accent: "sky" | "electric",
  // line:     lucide, title, line, line2, amount, example
  // stat:     lucide, label, figure, unit, note
  // cells:    lucide, title, cells: [[label, value], ...], note
  // counters: items: [[lucide, text], ...]
})

figureOut(ctx, parent, { text: "₦26.1m", x, y, size, rot, t0, t1, tone })
```

Where to use it:
- anywhere the film currently lifts a rectangle off the screen only to show a
  figure: the container says it better and never cuts a sentence;
- the moments with one loud number, which get a `figureOut` beside the
  container, in the margin, never over the phone's screen;
- three to six containers per cut is the right number. It is a punctuation
  mark, not wallpaper.

Do NOT replace the drawn light bodies on the day stages (`momentCard`,
`calendarCard`, `noticeCard`, `priceCard`, `listCard`, `proofCard`,
`flowRail`). The founder chose those himself from the cut he liked. The
container joins them; it does not evict them.

## 3. More in motion

- Every container breathes already (`breathe`, default 1).
- Where a chapter has empty stage beside the phone, drift one of the brand's
  3D objects through it with `object3d(ctx, parent, { name, size, x, y, t0,
  t1, drift })`. One or two, never a cloud, never over 260 px on the phone
  cut.
- Where a number is spoken, roll it (`odometer`) rather than cutting to it.

## What must not change

- **Determinism.** Every value a function of `t`. No timers, no `Math.random`
  (use `ctx.random(seed)`), no CSS transitions.
- **The voice.** Sentence and word anchors (`s(i)`, `w(i, "word")`) are the
  clock. Nothing may move a beat off its word.
- **The captions and the chapter pill.** Captions sit at y 1580 on the phone
  cut and y 1012 on desktop; the pill is at the top. Nothing may cover
  either. Use `ctx.hideCaptions(t0, t1)` only where the film already does.
- **The copy rules** (`scripts/marketing/DESIGN.md` section 2): no invented
  numbers (every figure must be one the live screens print), no testimonials,
  no promise words, "verified" only about people, no em dashes.
- **The desktop cut shows desktop screens.** The founder's ruling, twice.

## Checking your work

```
cd scripts/marketing/video
node films/layout-check.mjs how mobile > /tmp/.../faults.json    # must be []
node engine/render.mjs --proj how --film mobile --fps 60 --ending live \
     --stills 7.0,12.5,26.1,... --out /tmp/.../x.mp4             # look at them
```

`layout-check.mjs` catches geometry (text cut with an ellipsis, a box hanging
off the frame, two labels on top of each other). It cannot see a label that
repeats the headline or a card that says what the screen beside it already
says. Look at the stills yourself, at every transition and every container
you added, before and after.

DO NOT run a full render: it takes over an hour and the session renders the
four cuts itself at the end.

## 4. The second round (16 October, later the same day)

The founder sent the pump.fun App Store set itself and asked for more of it:
"I want stuffs in that area to be in my films and my screenshots, pick all
things you can, also think outside the box more to upgrade the motions film
more next gen". What is in those images, and what we take:

| In the blueprint | In Vallo |
|---|---|
| a key word set in a rounded box in the headline | `headline(..., { keyStyle: "chip" })` — the box opens behind the word as the word lands |
| small round coins scattered around the handset | `badgeDisc(ctx, parent, { name, kind: "object"\|"glyph"\|"mark", x, y, size, t0, t1, drift, tone })` |
| 3D props half cut by the panel's edge | place an `object3d` so it runs off the frame; the film has no edge check |
| a counter row inside the floating card | `popOut(..., { kind: "counters", items: [[glyph, text], ...] })` |
| the card overlapping the device, not beside it | a `popOut` may sit over the phone's status bar, its header or its bottom bar, never across a sentence on the glass |

Use them:

- ONE headline per cut takes the chip, and it is the cut's own promise, not a
  passing line. Two at most.
- Badges: three or four at a time, small (110 to 160 px on the phone cut),
  near the frame's edges, drifting, never over the captions or the pill. One
  `tone: "paper"` among them at most. Bring them in on a beat and take them
  out with the chapter.
- A counters row is for facts the screen under it prints (4 beds, 4 baths,
  380 m²), never for a tally we do not have.

### Next-gen motion, beyond the parts

These are the things that separate a motion film from a slideshow. Add what
your cut has room for:

1. **Hand-off.** A container does not merely leave: it flies to where the next
   thing arrives and the next thing grows out of it (`fly` from kit.js).
2. **Parallax.** When the camera pushes, move the furniture at a different
   rate from the phone, and the ground at a different rate again.
3. **Anticipation.** Nothing starts from rest: a card pulls back a few pixels
   before it flies, a number dips before it rolls.
4. **One thing leads.** Inside a beat, let one element arrive first and the
   rest follow it, rather than four things landing on the same frame.
5. **Overlap.** The outgoing beat should still be leaving as the incoming one
   starts. Dead frames between beats are what make a film feel cheap.
6. **The figure rolls.** Every number that matters arrives on an `odometer`,
   not as a cut.

## 5. The correction (16 October, same evening)

The founder, with a frame of ours beside pump.fun's: *"ours need to be black,
thick edges... make the things clean clear!!! Redo them all, not just those
line on the edges."*

`popOut`, `badgeDisc`, `figureOut` and the headline's chip are all redrawn:
solid ink, one thick bright edge, no corner brackets, no fuzzy glows, and the
`tab` label is now the card's first row rather than a tab astride the rule.
Nothing in your cut has to change for it, but:

- a `tab` and a stat's `label` now stack as two rows: they must not say the
  same thing;
- the containers are louder than they were, so if a beat now looks crowded,
  take away a badge, not the container.

## 6. What the blueprint actually is (the founder circling it twice)

pump.fun's floating card is not a card they designed. It is ONE ROW OF THEIR
OWN APP, lifted off the glass, blown up about 15 per cent, given a thick
bright edge, and dropped back over the place it came from, so it overlaps the
rows above and below.

The films already have that move: `lift` (phone) and `windowLift` (desktop).
Both now carry the heavy sky rule and their own glow, and the mounting board
and the vignette bands are gone. So:

- **Prefer `lift` over `popOut` wherever the thing being held up is on the
  screen.** The product at size, inside one rule, beats anything we draw.
- **Choose the crop on the component's own edges** (its rounded card, its
  row, its bar) with a few pixels of air. Chosen that way nothing is cut,
  which was the whole of the founder's complaint.
- `popOut` is for what the screen does not show in one place: a total, a
  breakdown, a rule, a promise.
