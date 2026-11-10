# The recordings

Eleven v3, the same voice as Videos One and Two. Recorded 17 October 2026.

| File | Film | State |
|---|---|---|
| `signup.mp3` | the sign-up film | **in use.** Aligned (95/95 words, DP cost 1.46) and installed as `films/signup/timeline.json`. |
| `referral.mp3` | the referral film | **in use**, on the founder's instruction, 17 October. It is the pre-correction read: see below. |
| `listing.mp3` | the listing film | **in use**, same instruction, same caveat. |

## What the two takes say that the product does not

They were recorded from `THREE-SHORT-FILMS.md` minutes before three lines in
it were corrected against the live product, so they say things Vallo does not
do. Proved, not guessed: aligning each take against the corrected script and
against the original gives

| | corrected script | original script |
|---|---|---|
| referral | DP cost 5.67, six flags | DP cost 3.37, two trivial flags |
| listing | DP cost 2.75, one failed alignment | DP cost 2.44, no flags |

and the recogniser's own free hypothesis for the referral take's third island
comes back `when a friend signs up with ed and finishes verifying who they
are`, which is the old line word for word.

The referral take says "No limit on how many friends you bring, and no catch
in the small print" over a film that shows the screen printing "Qualified
referrals counted a month: 1,500". The listing take says a place is live the
moment it is described, when every workspace is an application whose last
step is "Check and send".

The founder was shown this and chose to ship these takes rather than
re-record (17 October). So both films carry a line the screen behind it
contradicts, and the referral film's is the serious one: the voice says
there is no limit while the plate on screen prints 1,500 a month. Re-record
from the corrected blocks in `THREE-SHORT-FILMS.md` and both films pick the
new audio up without an edit - see `wq` below.

The takes also gave us the only measurement of how fast this voice actually
reads: 2.95 words a second with a 0.32 s breath, which is what
`films/provisional.mjs` is now tuned to.

## Putting a recording under a film

    python3 scripts/marketing/audio/timings.py --voice <take.mp3> \
        --script docs/marketing/voiceover/scripts/<proj>.txt --out <dir>
    node scripts/marketing/video/films/install-voice.mjs <proj> \
        <dir>/timings.json docs/marketing/voiceover/scripts/<proj>.txt

`install-voice.mjs` regroups the aligner's sentences into the script's own
lines (the films count sentences by line, s(1)..s(9)), places each on the
beat grid keeping the gaps the voice actually left, and snaps the music
markers to bar lines. It refuses outright if a word in the recording is not
the word in the script, which is how the two bad takes were caught.


## Why the films play on either take (`wq`)

A beat hangs on a word, and a rewritten line takes its words with it:
`w(7, "hundred")` threw outright on the take that was actually recorded,
because that line was "no limit on how many friends you bring". So
`anchors(ctx)` gained `wq`, which names the word in each wording it might be
spoken in, nearest equivalent first, and takes the first one the recording
actually has:

    wq(7, "hundred", "many")      the figure, or the word standing where the
                                  figure stands in the older line

Nine beats across the two films use it. Order matters and is the one thing
to get right: the corrected line runs "the TERMS sit on the SCREEN" and the
old one "no CATCH in the SMALL print", so terms maps to catch and screen to
small. Mapped the other way round the pose keyframes ran backwards in time
and a camera push began before the lift it was meant to follow.
