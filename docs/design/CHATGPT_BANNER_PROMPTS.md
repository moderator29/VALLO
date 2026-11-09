# ChatGPT image prompts for the Roommates and Circle banners

These prompts generate the people art for Vallo Roommates and Vallo Circle.
Every image is made in one shared style so the set reads as one family. When
an image is ready, send it in chat and it goes into
`apps/web/public/brand/features/<slot>.webp`. The banners pick it up from the
slots in `apps/web/src/lib/features/art.ts`.

## Paste this first (the style lock)

Paste this once at the start of the ChatGPT conversation, then send the
prompts below one at a time in the same chat:

> You are making a set of marketing illustrations for Vallo, a Nigerian
> property and community app. Every image in this conversation must share one
> style: photorealistic editorial photography with soft studio lighting and a
> warm rim light, shallow depth of field, a clean modern Lagos or Abuja
> setting, real young Nigerian adults (19 to 32) with natural skin texture,
> modern casual clothing in navy, white, denim and one warm orange accent
> (#FF8A3D). The colour grade leans to royal blue (#005FE8) and deep night
> navy (#040A1F) in the shadows. Do not add any text, logos, watermarks, app
> screens with readable words, or brand names. Do not use purple. People look
> happy and relaxed, never posed like stock photos. Keep faces respectful and
> natural. When I ask for a cut-out, give a PNG with a fully transparent
> background and soft natural edges, the subject centred with room around
> them.

## The prompts

### 1. roommatesHero (Roommates home banner, the main one)

> Cut-out, transparent background, 1600 x 1200. Three young Nigerian
> housemates, two women and one man, standing close together and laughing at
> a phone one of them holds. One wears a white over-ear headphone around the
> neck, one holds a mug, one has a small backpack. Waist-up framing. They look
> like friends who just found a flat together. Royal blue rim light from the
> right, warm orange accent in one jacket.

### 2. roommatesPromo ("New feature" promo banner in the feed and Circle)

> Cut-out, transparent background, 1400 x 1400. Two young Nigerian adults
> sitting on a modern sofa, one leaning on the other's shoulder, both looking
> at a tablet and smiling, one giving a small thumbs up. Full body, seated.
> Calm, trustworthy, "we found our people" mood. Royal blue rim light.

### 3. roommatesOnboarding (first-run card, "Find your ideal roommate")

> Cut-out, transparent background, 1400 x 1000. Four young Nigerian students
> (a mix of women and men) around a small table with laptops and coffee,
> chatting and pointing at one laptop, as if planning a shared flat. Waist-up,
> slightly from above. Friendly and energetic.

### 4. roommatesPublished ("Post published" celebration)

> Cut-out, transparent background, 1200 x 1200. A stylised 3D clay house in
> royal blue (#005FE8) with a warm orange door, soft rounded edges like a
> premium app icon, with a large glossy green tick badge floating at the
> lower right and a few small confetti pieces in blue and orange around it.
> No people. No text.

### 5. circleHero (Circle home banner)

> Cut-out, transparent background, 1600 x 1200. Five young Nigerian adults
> of mixed genders in a loose group in front of a modern Lagos townhouse at
> dusk, talking and gesturing as a community. One holds a phone, one has a
> notebook, one is mid-laugh. Waist-up, the house soft and out of focus
> behind them, fading to transparent at the edges. Royal blue evening light.

### 6. circlePromo (Circle "Ask the community" card)

> Cut-out, transparent background, 1200 x 1200. A young Nigerian woman
> holding a phone up and speaking into it with a speech-bubble-shaped soft
> blue glow beside her (no text in it), as if asking a question to a group.
> Waist-up. Confident, curious, friendly.

### 7. Optional backdrop (shared behind banners when no cut-out is used)

> 1920 x 1080, no people. A modern Lagos apartment interior at blue hour:
> floor-to-ceiling windows with the city lights, warm lamps, a clean sofa and
> plants. Shot wide, soft focus, colour graded to royal blue and night navy
> with warm lamp highlights. Leave the left half calmer for headline text.

## After you generate

- Send the PNGs in chat with their slot names: roommatesHero,
  roommatesPromo, roommatesOnboarding, roommatesPublished, circleHero,
  circlePromo, backdrop.
- Each one is converted to WebP (1x and 2x), checked in both themes, and
  wired into its banner. Until then the banners use the existing Vallo room
  photos, so nothing waits on the art.
