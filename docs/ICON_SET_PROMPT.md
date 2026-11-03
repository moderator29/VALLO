# Icon set brief for the listing, onboarding and verification flows

Paste the prompt below into ChatGPT (image generation). Ask for ONE sheet per category so the style stays the same, then cut each icon out and send the PNGs back. They go in `apps/web/public/brand/glyphs/` and replace the plain black and white glyphs.

## The prompt

> Design a set of small app icons for a Nigerian property and stays marketplace. Style: soft, clean, mature 3D clay and glass objects, one rounded form per icon, gentle depth, a single soft highlight from the top left, deep royal blue as the main colour with one small warm orange accent on each icon, no text, no letters, no outlines, no drop shadow baked in. Every icon is a single object, centred, on a fully transparent background, 1024 x 1024 px PNG, with equal padding of about 10 percent on every side, so it stays crisp when shrunk to 32 px and 48 px. Same lighting, same colours, same level of detail across the whole set. Do not use black or white as the main colour. Do not draw a plate, tile, circle or container behind the object. Return each icon as its own separate transparent PNG, named as listed.

## Icons to draw

**Build condition** (4): `condition-newly-built` (a new house with a small sparkle), `condition-renovated` (a house with a paint roller or small wrench), `condition-older-build` (an older house with a chimney and a weathered roof), `condition-off-plan` (a house shown as a blueprint sheet with a small crane).

**Furnishing** (3): `furnishing-furnished` (a sofa and a lamp), `furnishing-semi` (a sofa only, empty space beside it), `furnishing-unfurnished` (an empty room corner).

**Floor and size**: `floor-level` (a tall building with one floor lit), `floors-total` (a stack of floors), `size-area` (a floor plan with a measuring arrow), `bedrooms` (a bed), `bathrooms` (a bath), `toilets` (a toilet), `parking` (a car in a bay), `kitchen` (a cooker and pot).

**Power, backup and water**: `power-grid` (a power pylon), `power-always-on` (a pylon with a steady bulb), `power-patchy` (a pylon with a flickering bulb), `power-rarely` (a pylon with a dim bulb), `power-none` (a pylon crossed out softly), `backup-generator` (a small generator), `backup-inverter` (an inverter box with a battery), `backup-solar` (a solar panel), `backup-both` (a generator and an inverter), `water-mains` (a tap with a droplet), `water-borehole` (a borehole pump), `water-storage` (a water tank), `water-tanker` (a water tanker truck), `water-none` (a dry droplet).

**Tenure and ownership**: `tenure-freehold`, `tenure-leasehold`, `tenure-rent-yearly`, `tenure-by-the-night` (a key, a document with a seal, a calendar, a moon).

**Verification and workspace steps**: `step-basic-info` (a house with a pencil), `step-photos` (a camera), `step-location` (a map pin), `step-details` (a list on a clipboard), `step-pricing` (naira coins), `step-review` (a magnifier over a house), `step-submit` (a sealed envelope with a check), `step-identity` (an ID card), `step-selfie` (a face frame), `step-documents` (a folder with a seal), `step-payout` (a wallet), `step-approved` (a badge with a check).

**Roles**: `role-agent`, `role-realtor`, `role-landlord`, `role-host`, `role-restaurant` (a person with a briefcase, a person with a house, a house owner with a key, a host with a bell, a cloche).

## When the files come back

Send them in a zip or one by one. I will cut them to size, put them in `apps/web/public/brand/glyphs/`, and swap them in everywhere the plain glyphs are drawn now (the listing wizard, the host wizard, the workspace registration steps and the verification ladder).
