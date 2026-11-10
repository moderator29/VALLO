NATIVE STORE ICONS AND THE SHARE CARD

Date: 10 November 2026. Follows docs/handoff/BRAND_REFRESH.md, which refreshed the web icons and left the share card and the store icons in the old palette.

WHAT CHANGED

1. Share card (Open Graph, and Twitter which reads the same file). apps/web/src/app/opengraph-image.jpg, 1200x630, 47 KB (budget 95 KB, test limit 120 KB). Bright ground (white to pale blue, the app icon's own ground), the full-colour mark over the wordmark, the slogan "Space, without the runaround." in the brand ink and one quiet sub-line. The villa photograph and navy veil are gone. The path, size and the meta references are unchanged, and the image is only fetched by link unfurlers, so public page weight does not change.
   scripts/build-og-image.mjs now runs from the repository root: it resolves next/og from apps/web/package.json (it failed with "cannot find next" before). Run: node scripts/build-og-image.mjs

2. Native store icons, regenerated from the same vector art as the web set (scripts/build-brand-logo.mjs, new switch BRAND_ONLY_NATIVE=1, which writes only apps/web/assets, android/ and ios/ and leaves every web file alone):
   - iOS AppIcon.appiconset/AppIcon-512@2x.png: 1024x1024, plain RGB (no alpha channel), square corners (Apple rounds it). Contents.json untouched.
   - Android mipmap-ldpi to xxxhdpi: ic_launcher.png (rounded), ic_launcher_round.png (circle), ic_launcher_foreground.png (the mark alone on transparency), ic_launcher_background.png (bright full-bleed). Sizes 36, 48, 72, 96, 144, 192. File names unchanged.
   - Adaptive icon safe zone: the foreground mark is now 68 per cent of its file (was 62), which after the launcher's 16.7 per cent inset keeps every visible pixel inside the guaranteed 66-unit circle (tested by pixel).
   - Notification icon ic_stat_vallo.xml: white on transparent vector of the new mark (already rewritten earlier; regenerated identically).
   - Capacitor sources apps/web/assets/icon-only.png, icon-foreground.png, icon-background.png.
   Run: BRAND_ONLY_NATIVE=1 node scripts/build-brand-logo.mjs

3. Test: apps/web/src/lib/brand/native-icons.test.ts reads PNG headers and pixels (sizes, colour type, corners, safe zone, background brightness, adaptive XML targets, notification glyph).

DELIBERATELY NOT CHANGED

- The native launch bitmaps (android drawable*/splash.png, ios Splash.imageset) stay a flat navy field. src/lib/native/native-splash.test.ts holds that, on the founder's ruling of 7 November: the mark is drawn by the shell on top (iOS LaunchMark, Android LaunchMark.java), and a mark baked into the bitmap would sit in a different place from the drawn one.
- The shell's drawn layers (android drawable-nodpi/launch_tower*.png, launch_ring.png, launch_letter_*.png and the iOS Launch* imagesets) are separate cut-outs in the previous palette, which is close to the new one but has the darker low blue. No script in the repository cuts them, so they were not regenerated. A follow-up if the founder wants the opening mark identical to the icon.

HOW TO SEE IT

Nothing changes on any phone until a new build is installed. A new TestFlight build (iOS) and a new Play internal or production build (Android) must be made from this tree; the new icons ship inside the binary. An installed app keeps its old icon until it is updated. The share card is live as soon as the web deploy ships, but WhatsApp, iMessage and X cache an old preview per link, so a link already shared may show the old card for a while.

NOT VERIFIED WITHOUT A DEVICE

How each launcher masks the adaptive icon (circle, squircle, teardrop) and how the home screen shows the icon next to others. The safe zone and sizes are tested by pixel only.
