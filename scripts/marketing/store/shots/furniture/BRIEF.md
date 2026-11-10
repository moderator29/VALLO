# Furnishing a store shot: the rules

The founder's brief, 16 October 2026, with five pump.fun App Store images as
the blueprint: floating pop-out containers with a bright hairline and tick
edges, 3D props, oversized numbers, in Vallo's own identity. `callouts.mjs`
draws the containers, `furniture.mjs` places them, and each shot's recipe
lives in `a.mjs` (1-12), `b.mjs` (13-24) or `c.mjs` (25-35).

## The composition

The handset sits lower and a tenth smaller than it did, leaving two bands
that belong to the furniture: between the headline and the top of the phone,
and under the phone. Use them.

- **Card A straddles the top rim**, covering the status bar and the header
  and nothing else: `{ side: "left"|"right", at: 0.01, center: true, ... }`.
- **Card B stands in the bottom band**, its bottom edge off the foot of the
  image: `{ side: <the other side>, y: 0.962, anchor: "bottom", ... }`.
  It may kiss the phone's bottom bar. It must not reach the content above it.
- Put A and B on opposite sides. Two containers is the usual number; one is
  right for a quiet shot (a welcome screen, a language screen); three is too
  many.
- **Props**: one, sometimes two, of the brand's 3D objects, in a side margin
  beside or below the phone. `{ name, x | rx: 0.03..0.08, y: 0.72..0.84,
  size: 190..240, rot: -10..10 }`. Name the shot's subject (keys, receipt,
  hotel, restaurant, map, shield, calendar-booked...). Never a cloud of them.
- **The outlined figure** (`figures`) is for a shot with one loud number and
  room in a margin. At most a third of the set carries one.

## What a container may cover

NOT THE SCREEN'S SENTENCES. The founder's standing complaint is text cut
mid-word. A card may cover:

- the status bar, the header, the tab bar, the bottom bar (furniture);
- a photograph, or a whole self-contained component;
- the ground outside the phone.

It may not land across a paragraph, a title or a row of labels, and it may
not repeat a line that is visible right beside it. The container's own parts
must not repeat each other either: the tab, the eyebrow (`label`) and the
title each say a different thing.

## What a container may say

`scripts/marketing/DESIGN.md` section 2 holds, without exception:

- **No invented numbers.** Every figure a card prints must be printed on the
  capture under it. Read the capture (`docs/marketing/screens/<id>-ios.png`)
  before you write a word. No derived arithmetic either.
- **No testimonials, no user counts, no ratings, no "best" or "#1".**
- **No promise words** (safe, secure, protected, guaranteed, insured).
  "Vallo never holds your money" and "Vallo charges no inspection fee" are
  both true and may be said.
- **"Verified" only about people and businesses**, never about a listing.
- **No em dashes.** No email address, phone number or person's name (the
  greeting's "omojuni" is allowed).
- An amount that shows a booking, a table, a payment or an inspection carries
  `example: true` on a `line` card.

## The copy's measure

Every line in a container is set on one line (`white-space: nowrap`), so long
copy runs off the image and the edge check fails. Keep to about:

- `tab` 16 characters, `label` (the eyebrow) 28, `title` 24, `line` 30,
  `foot` 46, a `cells` label 12 and its value 9.

## Finishing

Render your own shots and LOOK at them:

```
cd scripts/marketing
node store/compose.mjs --store app-store   --only 7,8,9 --res 2 --proof /tmp/.../proof
node store/compose.mjs --store google-play --only 7,8,9 --res 2 --proof /tmp/.../proof
```

Zero problems reported, and the JPEG has to be worth sending to the founder:
nothing sliced, nothing repeated, nothing crowded, the screen still the hero.

## The second round (16 October, later the same day)

The founder sent the pump.fun App Store set itself and asked for more of it.
Three more parts exist now, and every shot may use them.

- **The stage panel.** A soft rounded field inset 52 px, drawn under
  everything, with two blurred blobs in it. It is ON by default for every
  shot; `panel: false` in a shot's entry turns it off. It is what the props
  and badges overhang.
- **The round badges.** `badges: [{ name, kind: "object"|"glyph"|"mark",
  x | rx, y, size, rot, tone }]`, the blueprint's scattered coins. Two to
  four per shot, 120 to 170 px, near the edges (x or rx between 0.045 and
  0.09 keeps them off the 40 px line), one `tone: "paper"` at most. `object`
  carries one of the brand's 3D objects, `glyph` a Lucide icon, `mark` the
  Vallo mark.
- **The key word in a chip.** Mark one word of the headline `*like this*` and
  set `keyStyle: "chip"` on the shot. The word goes in a rounded box in the
  brand blue instead of in the sky colour. Use it on the shots whose headline
  has one word worth marking; not on every shot, and never on a word the
  sentence does not turn on.

Shot 1 in `a.mjs` and its entry in `premium.mjs` are the worked example of
all three.

## The correction (16 October, same evening)

The founder, with his image beside pump.fun's: *"Look at the difference,
pumpfun own green back, ours need to be black, thick edges, you get it?! And
also make the things clean clear!!! Redo them all, not just those line on the
edges."*

What changed, in the parts, not in your recipes:

- **The container is solid ink with one THICK bright edge** all the way
  round. The hairline and the four corner brackets are gone. Nothing
  translucent, nothing fuzzy, no soft inner glows.
- **The stage panel is solid black**, as pump.fun's is solid green.
- **The badges** are solid with the same thick edge.
- **The label** (`tab`) is no longer a tab astride the rule: it is the card's
  first row, a lit dot and the word. Your `tab:` values all still work.

Nothing in a shot's recipe has to change for this. But two things are worth
a second look now that the label sits inside the card:

1. a `tab` and a stat's `label` now read as two stacked rows, so they must
   not say the same thing. Drop the `label` where the `tab` already says it.
2. the cards are louder than they were. If a shot now looks crowded, cut one
   of its badges rather than its container.

## What the blueprint actually is (16 October, the founder circling it twice)

He circled pump.fun's floating card, and then circled ours, and said: *"make
our own be like the pumpfun... you just putting small curve line on all
edges."*

The point he was making: **their card is not a card they designed.** It is
ONE ROW OF THEIR OWN APP, lifted off the glass, blown up about 15 per cent,
given a thick bright edge, and dropped back over the exact place it came
from, so it overlaps the rows above and below it. The content is the product,
at size. The design is only the rule round it.

So every shot's FIRST container is now a `mags` entry, not a `pops` entry:

```js
mags: [{ box: [54, 1816, 1266, 2545], scale: 1.16, dx: 0, dy: 26 }],
```

- `box` is in the capture's display pixels (1320 x 2868) and **must sit on the
  component's own edges** (its rounded card, its row, its bar), with a few
  pixels of air. Open the capture, find the component, read the box off it.
  Chosen that way, nothing can be cut, because the component is whole.
- `scale` 1.12 to 1.3. The blueprint's is about 1.15.
- `dx`/`dy` nudge it off its own place in page pixels, so it overlaps its
  neighbours rather than sitting exactly on them.
- Pick the component the HEADLINE is about. On shot 1, "Find your next home in
  Nigeria", it is the hero search card, which says exactly that.

A designed card (`pops`) is now the SECOND container at most, for something
the screen does not show in one place: a total, a breakdown, a rule. One
`mags` and one `pops` per shot is the shape. Shot 1 in `a.mjs` is the worked
example.
