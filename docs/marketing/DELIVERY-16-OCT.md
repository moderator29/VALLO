# The 16 October upgrade: what changed, and what to look at

The founder's brief, with five pump.fun App Store images as the blueprint:
the floating pop-out containers, the 3D props, the oversized prices, deeper
transitions, and "the films entirely upgraded".

## The four films

| | duration | picture | sound cues |
|---|---|---|---|
| Video One, phone | 2:27.7 | 1080 x 1920, 60 fps | 145 |
| Video One, desktop | 2:27.7 | 1920 x 1080, 60 fps | 131 |
| Video Two, phone | 3:36.9 | 1080 x 1920, 60 fps | 199 |
| Video Two, desktop | 3:36.9 | 1920 x 1080, 60 fps | 189 |

Masters at 1080p60 in the session's scratch; share copies (under 30 MB) in
`docs/marketing/videos/preview/`. Every mix is -14 LUFS, -1 dBTP, with no
effect capped under the voice.

## What is new in them

1. **Deep transitions on every chapter boundary** (12, 13, 15 and 14 of them).
   Five kinds: an iris of tick brackets that closes and blooms, a slab wipe
   with a lit leading edge, a bar shutter, a tile fall, and a light whip for
   a move inside a chapter. Never the same kind twice in a row.
2. **The product held up the blueprint's way.** Where the film shows
   something that is on the screen, it is now that component, lifted off the
   glass, blown up about 15 per cent, inside one heavy sky rule, dropped back
   over the place it came from. Every crop was re-measured onto the
   component's own edges (`films/blocks.py` finds them), so no heading,
   sentence or button is cut.
3. **The drawn container** only where no screen shows the thing in one place:
   a total, a breakdown, a rule, a promise. Solid ink, one thick rule, its
   label the first row.
4. **The coins**: small round badges carrying the brand's 3D objects,
   drifting at the frame's edges, in on a beat and out with the chapter.
5. **The key word in a box**, once per cut, on the cut's own promise.
6. **More in motion**: hand-offs (a card flies to where the next thing grows
   out of it), parallax planes on every camera push, anticipation before each
   move, one element leading each beat, overlap so there are no dead frames,
   and every number arriving on a roll.

Video Two still opens on the orange archway with its three cards, so the two
films are still tellable apart in a library before anyone presses play.

## The store set

70 images (35 App Store at 1320 x 2868, 35 Google Play at 1440 x 2560) plus
Play's feature graphic. Every one rebuilt on the same grammar: the screen's
own component lifted and blown up over its own place, at most one drawn card
beside it, a 3D prop, two to four coins, on a solid black stage panel. The
handset came down a tenth and sits lower so the two bands that furniture
needs exist.

Every check passes on every image: nothing within 40 px of an edge, no
headline shrunk to fit its measure, every headline over 4.5:1 against what
lies behind it, at least 16 px between a headline's lines, and both
hand-placed notification cards clear of the camera, the menu and the
greeting in both stores.

## The rules that did not move

`scripts/marketing/DESIGN.md` section 2, on every word in every container:
no invented numbers (every figure printed is printed on the screen under it),
no testimonials or counts, no promise words, "verified" only about people and
businesses, no em dashes, no email address, phone number or person's name.
