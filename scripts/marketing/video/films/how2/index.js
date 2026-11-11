/*
 * VIDEO ONE, the November 2026 cut ("How Vallo works"), rebuilt on the
 * upgraded platform: vertical 1080x1920, one cut, about 74 seconds. It sits
 * beside the old Video One (films/how) rather than replacing it.
 *
 * Build it (docs/marketing/screens is generated, not committed):
 *   cd scripts/marketing
 *   node screens.mjs --only v3-home,v3-search,v3-filters,v3-listing,v3-listing-cost,v3-listing-total,v3-saved,assistant,v3-stays,sc-stay,sc-restaurant,v3-circle,v3-circle-explore,v3-roommates,v3-roommates-2,v3-schools,v3-payments,v3-welcome
 *   node video/films/how2/lay-out.mjs                  # the provisional clock (until the voice exists)
 *   node video/engine/render.mjs --proj how2 --film mobile --ending live --fps 60 --out <dir>/how2.mp4
 *   node video/films/layout-check.mjs how2 mobile 0.25 # must come back with no faults
 *
 * Sound: audio/sfx.py, audio/music.py --timeline films/how2/timeline.json,
 * then films/how2/mix-bed.py (no voice yet) or films/finish.sh (with the voice).
 */
export const SCENES = ["main"];
