# The three short films — the brief

17 October 2026. The founder, having seen Videos One and Two upgraded to the
pump.fun blueprint: *"make sure the 3 videos are clean smart and also the
starting view should not be those get started once's you already used for the
until 2 videos don't use them again okay non inside the remaining 2… all
should be 10/10 video motion film… it should be everything worth it."*

Three films, one minute each, vertical (1080×1920), one cut apiece:

| proj | what it is | clock | opener |
| --- | --- | --- | --- |
| `signup` | Getting on Vallo takes a minute | ~50.7 s | `openerClock` |
| `referral` | Vallo pays you to bring people | ~52.0 s | `openerReward` |
| `listing` | List your own place, no agency fee | ~57.7 s | `openerOwner` |

The scripts are `docs/marketing/voiceover/scripts/<proj>.txt`; the prompts the
founder is recording from are `docs/marketing/voiceover/THREE-SHORT-FILMS.md`.

## The clock is provisional, and that is fine

`films/<proj>/timeline.json` was laid out by `films/provisional.mjs` at the
rate the two long films were actually spoken. When the real recordings land,
the aligner replaces the file and **every beat re-anchors itself**, because
nothing in a film may refer to a number of seconds. Hang everything on
`s(i)`, `e(i)` and `w(i, "word")` from `anchors(ctx)`. A literal time in a
film is a bug, with two exceptions already in the long films: the opening
frame's own clearance, and the phone's first rise before sentence one.

## The opening frame

Each film calls its own opener from `films/openers.js` (re-exported by
`kit.js`). **No film may touch `brand/onboarding/step-*`** — that artwork is
Videos One and Two's and the founder has banned it here. The openers are
composed and still at `t = 0`, because the still a chat shows before anyone
presses play is the first frame. Draw the film's own headline over the opener
and let the opener clear on `t1`.

## The grammar, unchanged from the long films

Read `films/UPGRADE.md` first — all six sections. It is the standing brief for
the containers, the transitions and the motion, and nothing in it is relaxed
here:

* **containers** — `popOut` (popout.js): solid `#04071C`, a **thick** `#8FD3FF`
  edge all the way round, the label as the first row. Never a hairline, never
  corner brackets. `figureOut` for an oversized stroked number, `badgeDisc`
  for a floating 3D prop.
* **transitions** — `slabWipe`, `shutter`, `irisTicks`, `tileFall`, `whipPan`
  (transitions.js). A chapter boundary is a cut, not a cross-fade. A
  one-minute film wants four to six of them, each different.
* **motion** — hand-off, parallax, anticipation, one thing leads, overlap,
  numbers roll. Nothing arrives at the same instant as anything else.
* **lifts** — a part held off a screen is cropped on the **component's own
  edges**. Measure them: `python3 films/blocks.py <capture> [y]`. Never
  eyeball a crop; a rule cutting through a heading is the founder's standing
  complaint.
* **the phone** — `hero(ctx, …)` carries the product. Poses move on the voice,
  with `H.swing` on the chapter turns.

## The rules that are not style

1. **Determinism.** Every value a pure function of `t`. No timers, no
   `Math.random` (use `ctx.random(seed)`), no CSS transitions. `ctx.el`'s
   attributes go in `attrs: {}` — a top-level key is silently dropped.
2. **Nothing real on screen.** No email address, no phone number, no real
   person's name, ever (DESIGN.md section 2). The sign-up captures `su-filled`,
   `su-agreed` and `su-sent` currently carry a real address: see the sign-up
   film's own brief.
3. **Claims.** Every figure and promise must already be in `FACTS-OCT.md`. If
   the script says it, it has been checked; do not add a number of your own.
4. **Captions and pill.** `installCaptions` and the chapter pill are installed
   by the engine. Use `ctx.hideCaptions(t0, t1)` where the same words are
   already big on screen, and `ctx.hidePill(t0, t1)` where a push brings a
   screen's own heading up under it.
5. **The ending.** `ending(ctx, { t0, tLine, tBadges, tUrl, t1 })` closes every
   film on the last sentence, "Vallo. Real estate, done right."

## Checking your own work

```
node engine/render.mjs --proj <proj> --film mobile --stills 0,4.2,11.5 --scale 1
node engine/render.mjs --proj <proj> --film mobile --sheet 0.5 --scale 0.5
node films/layout-check.mjs <proj> mobile 0.5 > /tmp/<proj>-faults.json
```

`layout-check.mjs` must come back with **zero** faults: no ellipsis, nothing
hanging off the frame, no two labels on top of each other, no clipped body.
Then look at the contact sheet yourself, second by second, as a viewer would.
