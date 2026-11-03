# ChatGPT prompts for the email banners

Each prompt is ready to paste into ChatGPT image generation. Save the result
at exactly 1200 x 480 px (2x of the 600 x 240 slot; the newsletter shows it
520 wide) as a PNG, under the file name and path given. If ChatGPT returns a
different size, resize or crop to 1200 x 480 before saving.

Shared brand notes (already in every prompt):

- Palette (the dark email palette in `apps/web/src/lib/email/theme.ts`):
  ground `#010118`, card navy `#000030`, panel navy `#000040`, edge
  `#102D55`, rim `#2768C4`, text white `#FFFFFF`, body mist `#D5DEFF`, muted
  mist `#8E9CC4`, brand blue `#0C6AEF`, deep blue `#0056D0`, sky highlight
  `#5C9FFF`. One blue family only. No warm hues, no gold, no purple.
- Feel: calm, premium, Nigerian-market aware, in the style of the glassy 3D
  objects in `apps/web/public/brand/3d/email`.
- Safe zone: keep the text centred in the middle 60 percent of the width. Phones
  crop the sides, so nothing important sits near the left or right edge.
- No stock people, no faces, no extra logos, no small print, no URLs.

## Newsletter

### newsletter-1
Path: `apps/web/public/brand/email/banners/newsletter-1.jpg`

```
Create a wide email banner image, exactly 1200 x 480 pixels (5:2). Deep dark navy background (#010118) with a soft glow of electric blue (#0C6AEF) rising from the bottom centre. In the centre, the headline in clean white bold sans-serif (Poppins style): "A first letter from Vallo". Around it, a few floating glassy 3D objects in translucent blue glass with a bright top edge (a small house, a key, a calendar), arranged symmetrically toward the left and right but leaving the middle 60 percent clear for the text. Premium, calm, modern. Colours only from this family: #010118, #000030, #000040, #102D55, #2768C4, #0C6AEF, #0056D0, #5C9FFF, white and #D5DEFF. No people, no faces, no stock photography, no extra logos, no small text. Text must be spelled exactly as given.
```


```
Create a wide email banner image, exactly 1200 x 480 pixels (5:2). Deep dark navy background (#010118) with a gentle electric blue (#0C6AEF) glow behind the centre. The headline in clean white bold sans-serif, centred: "Why Vallo exists". Beside it, on the far left and right only, glassy 3D objects in translucent blue glass with a bright top edge: a shield with a check mark on one side, a house on the other. Keep the middle 60 percent clear for the text. Calm, trustworthy, premium. Colours only from: #010118, #000030, #000040, #102D55, #2768C4, #0C6AEF, #0056D0, #5C9FFF, white and #D5DEFF. No people, no faces, no stock photography, no extra logos, no small text. Spell the headline exactly.
```

### newsletter-2
Path: `apps/web/public/brand/email/banners/newsletter-2.jpg`

```
Create a wide email banner image, exactly 1200 x 480 pixels (5:2). Dark navy background (#010118) with a sweeping, subtle electric blue (#0C6AEF) light path curving from the lower left to the upper right, like a road toward the horizon. The headline in clean white bold sans-serif, centred: "Where we are going". Small glassy 3D objects in translucent blue glass along the path at the far left and far right (a map pin, a compass, a rocket-free simple arrow). Keep the middle 60 percent clear for the text. Forward-looking, confident, not hype. Colours only from: #010118, #000030, #000040, #102D55, #2768C4, #0C6AEF, #0056D0, #5C9FFF, white and #D5DEFF. No people, no faces, no stock photography, no extra logos, no small text. Spell the headline exactly.
```

### newsletter-3
Path: `apps/web/public/brand/email/banners/newsletter-3.jpg`

```
Create a wide email banner image, exactly 1200 x 480 pixels (5:2). Dark navy background (#010118) with a calm electric blue (#0C6AEF) glow from beneath. The headline in clean white bold sans-serif, centred: "Ready for the market". At the far left and far right only, glassy 3D objects in translucent blue glass with a bright top edge: a padlock, a lightning bolt for speed, a chat bubble for support. Keep the middle 60 percent clear for the text. Steady, prepared, premium. Colours only from: #010118, #000030, #000040, #102D55, #2768C4, #0C6AEF, #0056D0, #5C9FFF, white and #D5DEFF. No people, no faces, no stock photography, no extra logos, no small text. Spell the headline exactly.
```

## Other emails (optional, not wired in yet)

These two are for the founder to use later. Nothing references them today; if
you want them in the emails, ask for the markup to be added. Same size, same
rules.

### welcome-hero
Path: `apps/web/public/brand/email/newsletter/welcome-hero.png`

```
Create a wide email banner image, exactly 1200 x 480 pixels (5:2). Deep dark navy background (#010118) with a warm-feeling but strictly blue glow (#0C6AEF) opening like a doorway of light in the centre. The headline in clean white bold sans-serif, centred: "Welcome to Vallo". Glassy 3D objects in translucent blue glass with a bright top edge at the far left and right: an open door, a house key. Keep the middle 60 percent clear for the text. Inviting, calm, premium. Colours only from: #010118, #000030, #000040, #102D55, #2768C4, #0C6AEF, #0056D0, #5C9FFF, white and #D5DEFF. No people, no faces, no stock photography, no extra logos, no small text. Spell the headline exactly.
```

### code-hero
Path: `apps/web/public/brand/email/newsletter/code-hero.png`

```
Create a wide email banner image, exactly 1200 x 480 pixels (5:2). Deep dark navy background (#010118) with a cool electric blue (#0C6AEF) glow. The headline in clean white bold sans-serif, centred: "Your Vallo code". Glassy 3D objects in translucent blue glass with a bright top edge at the far left and right: a padlock and a key. Do NOT draw any digits or an example code anywhere. Keep the middle 60 percent clear for the text. Secure, quiet, premium. Colours only from: #010118, #000030, #000040, #102D55, #2768C4, #0C6AEF, #0056D0, #5C9FFF, white and #D5DEFF. No people, no faces, no stock photography, no extra logos, no small text. Spell the headline exactly.
```
