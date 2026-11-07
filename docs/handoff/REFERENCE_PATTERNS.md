# REFERENCE PATTERNS (HAUSLET AND OTHERS)

One entry per screenshot the founder sends, numbered in the order received.
Each entry: what it is, the pattern worth learning, and what Vallo does
instead (better, in Vallo's own identity). We learn patterns, never copy
branding, logos, wording or assets.

Privacy: no screenshot showing a real person's ID, document number or email
is ever copied into the repository, docs or help pages. Help-centre images use
demo data only.

---

## Batch 1 (7 November 2026, 15 images)

### R1. GitHub Actions: Native iOS run #156 (not Hauslet)
- **What it is.** The founder's proof that the native iOS workflow compiled
  and produced a signed archive (2 artifacts, 4m 19s, commit `cba7422`,
  Xcode 26.3).
- **Takeaway.** Build 1.0.1 exists. No action in this upgrade; any change
  that needs a new native build goes to `NATIVE_BUILD_QUEUE.md` and ships in
  one planned build.

### R2. Privacy choices sheet (first launch)
- **Pattern.** A full screen, plain-language consent: "Help us improve your
  experience". What is measured, why, that essential services are always on,
  that the OS will also ask about tracking, that choices are per device and
  changeable later. Three actions, equal weight: Accept all, Only necessary,
  Manage preferences (text link). A policy link.
- **Vallo.** Vallo has a consent surface already (audit). Upgrade it to the
  same honesty and calm: one screen, two equal pill buttons (no dark pattern
  where "Accept" is louder), a quiet "Choose what to share" link to a sheet of
  switches, and it never appears before the first useful screen on a cold
  start. Better: show a one-line summary of what was chosen in Settings,
  Privacy, with the date.

### R3. Search tab (signed out)
- **Pattern.** A big pill search field with a placeholder that is a real
  example ("Serviced apartment in Ikoyi"), a three-way segmented control
  (Shortlets, Rentals, Sales) with the active segment as a raised white pill
  and a thin accent icon, "Near me" row with a round icon tile, then
  "Suggested searches": each row a soft square icon tile, title, and a grey
  meta line ("Popular . 2 beds . Apartment"), hairline separators. Bottom
  tabs: five, thin line icons with labels, the active one filled in accent.
- **Vallo.** Search opens on the same calm structure but fed by Vallo's real
  data: recent searches first (on device), saved searches with alert state,
  then popular areas from real listing counts. Segments match Vallo's
  verticals (Rent, Buy, Stays, Tables). "Near me" asks for location only on
  tap, with a Vallo pre-prompt.

### R4. Sign-in completion: "Confirm your information" sheet
- **Pattern.** After Apple sign-in: a success banner at the top ("Signed in
  successfully." with an X in a grey square), the page behind blurred and
  dimmed, a bottom sheet with grabber, title, close X, one sentence of why
  ("make sure your name matches your government-issued ID"), an info card
  about the private Apple relay email, one large labelled field, a tall
  accent primary pill and a pale secondary pill "Skip for now".
- **Vallo.** Same stacked-sheet onboarding: banner, then sheet, with the
  page behind still visible. Vallo adds: name pre-filled from the provider,
  a live "This is how hosts will see you" preview line, and the relay email
  note linking straight to Settings, Account.

### R5. "Add a profile photo" sheet
- **Pattern.** The next banner replaces the previous one ("Thanks, your
  profile is confirmed."), the next sheet rises: title, one sentence saying
  it is optional, a large tinted circle with a thin person glyph, dark
  primary "Choose a photo", pale "Skip for now".
- **Vallo.** Same sheet, plus "Take a photo" on native (camera), a crop
  circle preview, and an honest note that the photo is shown to people you
  deal with. Banners replace, never stack (FeedbackBanner queue).

### R6. Community commitment (full page)
- **Pattern.** Soft tinted header with a large faint outline of the brand
  shape, small brand mark, uppercase grey eyebrow, a huge bold headline ending
  in an accent full stop, a lead sentence, a tinted card with a round tick and
  the pledge text, an accent "Learn more" link with arrow, and a sticky bottom
  bar: pale "Decline" and accent "Agree and continue" side by side.
- **Vallo.** A Vallo Community Promise in Vallo's own words and art, same
  structure. Accent full stop in headlines is a strong, cheap identity device:
  Vallo adopts its own version (the Vallo mark colour on the final stop of
  page titles on hero screens only, not everywhere).

### R7 and R8. "About the commitment" policy sheet
- **Pattern.** A tall bottom sheet over the blurred page: grabber, close X,
  big bold title with accent stop, Q and A sections (bold question, grey
  answer, accent bullets), inline accent links, an external-link row at the
  end, and a sticky pale "Go Back" pill.
- **Vallo.** Policies and explainers open as `Sheet` with a sticky footer.
  Long legal pages keep their own full routes for the web and search
  engines; the sheet shows the summary and links to the full page.

### R9. "Never miss an update" (notification pre-prompt)
- **Pattern.** After the welcome banner, on the profile page behind a blur:
  a sheet with a tinted bell tile, one sentence of what you get (messages,
  booking updates, viewing reminders), a small grey note ("You'll choose on
  the next screen. Your marketing preferences stay unchanged."), dark
  "Enable notifications", pale "Not now".
- **Vallo.** Already built as the `notify` beat of first run (P0.4b). Polish
  to this standard: bell tile, the exact list of what Vallo will send, the
  "you choose next" honesty line, and a success banner after Yes.

### R10. The system prompt, then the profile
- **Pattern.** The OS prompt appears only after the app's own Yes. Behind it:
  Profile with a big bold title, a bell button top right, a large rounded
  profile card (avatar, name, "Member since", three stats in a sunken strip:
  Reviews, Rating, New Member), a "Complete your profile" tinted card with
  rows and a dismiss X, a "List on Hauslet" promo row, list rows with thin
  icons and chevrons, and a floating dark pill "Switch to Agent Tools" over
  the content above the tab bar. Avatar letter as the Account tab.
- **Vallo.** Profile hub keeps Vallo's richer content (passport, trust
  score) inside the same calm card. The role switch lives in the side nav
  (founder's ruling) AND as a floating pill on the mobile profile. "Complete
  your profile" becomes a real checklist (photo, phone, ID, passcode) with a
  progress ring, each dismissible.

### R11 and R12. "What do you manage?" sheet (agent side, first entry)
- **Pattern.** Over a blurred dashboard: four big option cards (icon, bold
  title, one grey line): Rentals, Shortlets, Sales, A mix of services. The
  selected card gets a tinted fill, accent border and a tick on the right.
  Accent "Continue" and pale "Skip for now (use All)".
- **Vallo.** Same first-entry sheet on the agent side, using Vallo's
  verticals (Rentals, Sales, Stays, Restaurants, Everything), writing to the
  dashboard focus preference. Changeable from "Customise" on the dashboard.

### R13. Agent calendar
- **Pattern.** Big title, an "All" filter pill top right, month name with an
  accent full stop, a chevron month picker, year in grey, prev and next round
  buttons, a "Month" view pill and a round property filter button. A white
  rounded card holds a grid of rounded day cells (today tinted with an accent
  border, other months greyed). A legend of sparkle glyphs with counts:
  Check-in, Check-out, Viewing, Blocked. Agent tab bar: Dashboard, Listings,
  Activity, Calendar, Account (avatar letter).
- **Vallo.** Vallo's agent calendar adopts the rounded-cell grid and the
  legend-with-counts, fed by real bookings, viewings and blocks, with tap a
  day to open a sheet of that day's events and quick block or unblock.

### R14. Agent activity
- **Pattern.** Big title, "All" filter pill, a segmented control (Bookings,
  Applications, Viewings), then a scrolling underline tab row with counts
  (All (0), Pending (0), Upcoming (0), Ongoing (0), Completed), a sunken
  search field "Search by listing or booking ref", and a centred empty state:
  thin calendar glyph and one grey line.
- **Vallo.** One Activity inbox on the agent side with the same two-level
  filter, counts from real data, and designed empty states with one action
  ("Share your listing").

### R15. Help guide page on the website (in-app browser)
- **Pattern.** A docs site ("Pages") with brand mark, search, a tinted tip
  callout with a bulb icon, "Before you start" bullet checklist, numbered
  "Step 1: Start a new listing" sections, inline accent links, and a real
  screenshot strip of the app's action chips (Add listing, Applications, Find
  leads, Calendar). States that app and web steps are the same.
- **Vallo.** A Vallo Help Centre (P1.7) with the same article anatomy: tip
  callouts, "Before you start", numbered steps with Vallo's own screenshots
  taken after the upgrade with demo data, and deep links that open the real
  screen in the app.

---

## Patterns that repeat across this batch (the language to adopt)

1. Success banner at the top, replaced not stacked, with a dismiss X.
2. Stacked bottom sheets over a blurred, dimmed page for one-question
   onboarding steps.
3. One primary (accent or ink) plus one pale secondary pill, both full width
   and about 56px tall.
4. Huge bold titles; accent full stop on hero titles.
5. Thin line icons in soft square tiles; tinted circles for hero glyphs.
6. Segmented controls as a sunken track with a raised white active pill.
7. Big rounded white cards with hairline borders, almost no shadow.
8. Honest small grey notes under actions ("You'll choose on the next screen").
9. Empty states: one thin glyph, one grey sentence, centred.
10. Counts inside filter tabs, in grey, the active count in accent.

---

## Batch 2 (7 November 2026, 16 images): the listing flow and its help article

### R16. Help article header ("How to list your property")
- **Pattern.** Breadcrumb "Pages / Resources for hosts" (the section in
  accent), a huge headline, a grey lead paragraph of what the guide covers,
  byline and date, then a real screenshot of the wizard (side rail "Steps to
  Publish" with 7 sections, the current one numbered in accent) and a plain
  intro: "one question per screen, saves as you go, stop and pick up".
- **Vallo.** The Help Centre article template (P1.7): breadcrumb, headline,
  lead, byline "Vallo Team" with a real date, hero screenshot of OUR screen,
  then the steps. On a wide screen the wizard itself gets the same side rail
  of sections (the StepFrame's section list), on a phone the eyebrow does
  that job.

### R17. Agent "Your Listings", empty
- **Pattern.** Big title; segmented filter with counts (All 0, Shortlets 0,
  Rentals 0, Sales 0); three square icon buttons (filter, live, location)
  beside a sunken search ("Search by property name, date..."); centred empty
  state (thin house glyph, "No listings here yet.", an accent link "How to
  list your property" into the help article); a round accent FAB "+" above
  the agent tab bar.
- **Vallo.** The agent Listings workspace gets the counted segmented filter,
  the one search field, and an empty state whose action links to Vallo's own
  help article. FAB stays (ruling 19 kind 5: one per screen, clear of the
  dock).

### R18 to R27. The wizard, step by step (as shown inside the article)
Each step is a StepFrame: an eyebrow section name, a question title, an
optional grey why-line, the answer, and a bottom bar "Back . Step N of 12 .
Continue". A save state top right: "Saved in this browser" before an account
draft exists, then a green "Saved".
1. **THE BASICS, "What are you listing today?"** Three option cards with an
   icon, a bold name and a one-line meaning (Shortlet: booked by the night;
   Property for rent: longer lets, paid yearly, quarterly or monthly; Property
   for sale: outright or in instalments). Radio circle top right; selected =
   heavy ink border and filled radio.
2. **"What's your connection to this property?"** Why-line: so people know
   who they are dealing with, changeable until submit. Four cards: landlord
   (I own it), agent (I represent the owner), developer (I built it),
   individual (posting independently).
3. **"What kind of property is it?"** (rent and sale only) Residential or
   Commercial, "This decides which questions come next." From here the draft
   is saved to the ACCOUNT, not just the device.
4. **"Which best describes it?"** A four-column tile grid of property types
   (Apartment, Flat, Duplex, Studio, Room, Serviced Apartment, Guesthouse,
   Penthouse, Bungalow, Terrace, Maisonette, Mansion, Fully Detached,
   Semi-Detached), each tile a thin glyph and a label.
5. **LOCATION, "Where is the property?"** A search field for street, estate
   or area, OR State (select) + Area or city + Street address + House number
   (optional). A grey privacy card "Who sees the exact location": publicly an
   approximate area about 800m wide, the exact address only after a booking
   is confirmed, and confirming the pin is the publisher's check, not the
   platform's verification.
6. **"Is the pin on the entrance?"** A map with the pin, the address line
   under it, and a pale "Change Pin Location" button.
7. **DETAILS, "How many rooms does it have?"** Number chip grids for
   Bedrooms (1 to 10+), Bathrooms, Toilets (optional, 0 up); floor area
   optional. For a shortlet: what guests get (entire place, private room,
   shared) and maximum guests.
8. **PRICING, "What's your nightly rate?"** One large naira field with a
   "/ night" suffix and a grey note: weekend rates, discounts and rules come
   after the draft exists.
9. **GUEST CHARGES, "Any charges on top of the nightly rate?"** Chips with
   radio circles (None, Cleaning Fee, Caution Fee (Security Deposit),
   Generator / Diesel Surcharge, Extra Guest Fee, Estate Access / Service
   Charge, Pet Fee). Each chosen charge becomes a card: amount, a naira or
   "% of night" toggle, a Per stay / Per night segmented control, a computed
   line "= N10,000, per stay", an X; then "Add another charge". For rent: per
   year, quarter or month, then what a tenant pays to move in; for sale: what
   a buyer pays on top.
10. **PHOTOS, "Add photos of the place."** "At least 3. We sort them into
    rooms, the first one is your cover." A green readiness banner "Enough
    photos to submit, 3 ready, most listings use 8 or more", a "Photos ready"
    row, a grid with the cover crowned, an empty add tile.
11. **FINISH, "Describe the property."** "We wrote a first version from your
    answers. Edit it freely." Title with a 26/150 counter, a description
    pre-written from the answers, "Write with AI" and "Rewrite from my
    answers" as pale full-width buttons.
12. **Check and submit.** A list of every answer with a grey "Change >"
    button (Rooms and size, Space and guests, Nightly rate, Guest charges,
    Photos "3 photos (8 recommended)", Title and description), a grey note
    that amenities, house rules, viewing times and requirements are optional
    and can be added after submitting, and the primary becomes "Submit for
    review".

### R28. "What happens next" (end of the article)
- **Pattern.** Bullets: every listing is reviewed before it goes live and
  shows Pending Review; you are notified on approval; if your ID is not
  verified you are asked to verify first; stopped part-way, open Listings and
  "Continue draft". "Ready? Start your listing." An author card.
- **Vallo.** Vallo's article ends the same way, and the product matches it:
  a listing status "In review", a push and banner on approval, the
  verification gate on submit, and a "Continue draft" row on the Listings
  workspace.

### R29 to R31. The real wizard in the app
- **R29, step 1 of 7.** Full screen: only a close X top left on the first
  step, a 4px accent progress bar, the eyebrow, a large title, option cards
  with an icon, a bold name, a grey meaning and an empty radio circle. Bottom
  bar: "Step 1 of 7" and a large dark "Continue". (The total changes from 7
  to 12 once the kind is picked: the flow is computed from the answers.)
- **R30, step 2 of 12.** Back chevron left, "Saved on this phone" with a
  phone glyph in the middle, X right. Selected card: thick ink border and a
  filled radio dot.
- **R31, step 3 of 12.** Residential or Commercial, two cards, "This decides
  which questions come next."

### Patterns this batch adds
11. **The step count is honest and computed**: it grows when an answer adds
    questions (7 before the kind is known, 12 after).
12. **The save state names WHERE it is saved**: "Saved on this phone" before
    an account draft exists, "Saved" once it is on the account.
13. **Privacy is explained at the moment of asking** (who sees the exact
    address), in a grey card under the fields.
14. **Charges are cards with live arithmetic**, never a bare list of fields.
15. **The AI writes a first version from the answers**, and the person edits
    it; AI is a button, not a takeover.
16. **The review page is the checklist**: every answer with Change, and the
    one thing that blocks (verification) named there.
17. **Help articles show the real screens** with the same demo data, and end
    with "What happens next" and a link straight into the flow.

---

## Batch 3 (7 November 2026, 16 images): the wizard's inner steps, the ID check, the agent dashboard

Privacy: R37 to R42 show the founder's real NIN slip, face and number. Only
the PATTERN is recorded here; no name, number, date or photo is copied.

### R32. Rooms (step 7 of 12)
Number chip grids, two rows of five, for Bedrooms and Bathrooms (1 to 10+),
Toilets optional (0 to 9+), Floor area optional as a field with an "m2"
suffix. Top bar: back, green "Saved", close. Vallo: the wizard's rooms step
(group 3) uses the same chips on `OptionCards`' sibling, number chips.

### R33. Move-in charges (step 9 of 12, a rental)
Each charge a card with an X: amount field, a naira or "% of rent" switch, a
Once / Yearly / Monthly segmented control; "Add another charge"; a tinted
info card "A tenant pays to move in: N250,000 (one rental period plus these
charges)". Vallo: the live move-in total is the headline of the step.

### R34. Photos (step 10 of 12)
Tinted info banner "Add 2 more photos, 1 ready", a grey "Photos ready" row,
a grid with the cover crowned, a menu dot on each photo, a dashed add tile.

### R35. The AI consent dialog
A system-style alert naming the provider, exactly what is shared (titles,
city, details, amenities, the text you choose), that it covers future uses on
this device, how to withdraw (Profile, Privacy), "Only continue if you agree",
Agree and continue / Keep editing manually. Vallo: the same honesty in a
Vallo sheet (`lib/ai/consent.ts` already records consent), naming Vallo's
actual provider.

### R36. ID check: country (verify.hauslet.com in the in-app browser)
A five-dot labelled stepper (Country, Document, Capture, Upload, Review), Back,
"Which country issued your ID?", "This decides which documents we can accept
and how your identity is checked", a search field, POPULAR (Nigeria, Ghana),
ALL COUNTRIES with flags and codes, a disabled Continue until chosen, and
"Protected by Hauslet . Your data is transmitted securely".
**Vallo: BUILT (group 3).** `CountryPicker`, step 1 of the flow.

### R37. "Check your capture" (capture 1 of 2)
The photo large on a grey stage, "Front of document" with "Zoom in", the hint
"Check every edge and all the text. Retake if anything is cut off, blurry or
covered by glare", "Choose another file" and a strong "Use photo".
**Vallo: BUILT.** `IdCapture`'s check moment.

### R38. "Quick selfie check"
"Center your face", an oval live camera, "Start video check", "Back to
documents". Vallo already has the oval live selfie (`SelfieCapture`).

### R39 and R40. "Review and submit"
A seven-dot stepper all ticked to Review, a bordered notice "Final step,
submission required: your documents are uploaded, but have not been submitted
yet", document type and the ID number with Change, each photo (front, back)
in a card with Zoom in, a green "Captured" badge and Retake, "Selfie check
complete / Retake selfie", the primary "Submit for verification" and "Verification
begins immediately once submitted".
**Vallo: BUILT**, with one deliberate difference: Vallo never shows an ID
number back on screen (Hauslet prints it in full).

### R41. Personal information
Big title, tabs (Basic information, Travel companions), rows: Legal name,
Display name, Email (masked), Phone number(s) "Not provided" with why it is
needed, ID verification "Not started", Residential address, Emergency
contact, each with a grey "Edit / Change / Add / Start >" pill.
Vallo: group 4, the account's personal information page in this shape, with
ID verification and phone as rows (the place they live now that sign-up no
longer asks).

### R42 to R43. Agent Listings with one draft, and "Filter by status"
A listing card (image placeholder, type label with a spark, title, Status
"Draft", Published "Not Published"); a status filter sheet (All statuses, All
good, Pending Review, Changes Required, Draft, Deactivated, Archived) with a
tick on the chosen one.

### R44 to R47. Agent dashboard
Workspace pill "Personal, Vallo Spaces" with chevron, bell with a count;
"Welcome back, Vallo!" with the date and "Customize"; a "Getting started"
card, "2 of 4 complete", a progress bar, struck-through done rows with green
ticks, open rows with an arrow (Add payout details, Verify your identity);
quick action chips (Add listing, Applications, Find leads); "Overview." cards
with counts and tiny status glyphs; "Needs attention. (4)" cards (Verify your
identity, Set up a payout account with Set up / Dismiss / Snooze, Verify your
phone number); "Workspace finances." cards (Next payout, Pending N0.00); a
week strip calendar with a legend (Check-in, Check-out, Viewing, Rent due,
Sales Closing, Move-in); a "Choose your bank" sheet with search and bank
logos in round tiles.
Vallo: group 4, the agent dashboard's "Getting started" and "Needs attention"
cards fed by real state (phone, identity, payout, first listing), and the
bank chooser sheet on the payout screen.

### Patterns this batch adds
18. A labelled stage stepper for a long check (Country, Document, Capture,
    Review), next to the thin bar.
19. Every photo of a document has its own Zoom in, Captured badge and Retake.
20. A "Final step: nothing is sent yet" notice before the one button that sends.
21. Task cards with inline actions (Do it / Dismiss / Snooze), counted in a
    "Needs attention (N)" heading.
