# The three locale drafts: what is declared, what is a draft, and what to send a speaker

> **Money, as of 17 October 2026.** Vallo never holds customer money. A wallet, escrow or held payment kept by Vallo itself was retired on 25 September 2026 (Track A), and where this document describes one it describes the past. Since ADR 0003 a licensed partner may hold a payment in escrow, offered only while `protectedRailLive()` reads it as working. The current truth is [`docs/MONEY_ARCHITECTURE.md`](/docs/MONEY_ARCHITECTURE.md).

Written 23 September 2026. Counted by `apps/web/src/lib/i18n/locale-completeness.ts`
and by `suppliedKeys` from `packages/i18n`, never by hand. The numbers below come
from the same `suppliedKeys(dictionary)` call the completeness gate uses, so this
file and that gate cannot disagree.

**Nothing in this file is a translation.** No Yoruba, Hausa or Igbo word was
invented to write it. The founder can hire a speaker; he cannot un-ship a wrong
word in somebody's language.

---

## 1. WHAT A DRAFT IS, BECAUSE THE WORD IS DOING REAL WORK HERE

A locale file is a deep partial merged over English by `withFallback` at module
load. That gives two different gaps and they are not the same problem:

1. **A key the locale never declared.** English is served. Honest, invisible in
   the file, and a plain copy gap.
2. **A key the locale DECLARED and filled with the English string.** That is a
   DRAFT. It raises the locale's apparent coverage, it is identical on screen to
   case 1, and a key count cannot see it. This is the class the completeness
   gate exists to catch and the class this file counts.

`locale-completeness.ts` counts only keys a locale DECLARED, which is why it is
used here rather than a hand count: adding one English key to `en.ts` would
otherwise raise the draft figure for all three locales at once.

---

## 2. THE NUMBERS, PER LOCALE

English carries **3369 string keys** across the whole product.

| | Yoruba (`yo`) | Hausa (`ha`) | Igbo (`ig`) |
|---|---|---|---|
| Keys DECLARED by the locale | 2829 | 2833 | 2829 |
| Of those, DRAFTS (declared, English inside) | **97** | **99** | **104** |
| Of those drafts, full English sentences | 57 | 57 | 57 |
| Draft share of what the locale declared | 3.4 per cent | 3.5 per cent | 3.7 per cent |
| Keys never declared at all (English is served) | 540 | 536 | 540 |

**Read the last row before the others.** Each of the three leaves over five
hundred keys undeclared, which is more than five times the draft count. Those
are silent: English is served and nothing anywhere says so. They are a copy gap
for a speaker to close rather than a defect, and the completeness gate ignores
them deliberately. But a brief that asked a speaker for only the drafts would
close three per cent of the problem and leave the screen still mixed.

**The three drafts lists are nearly one list.** 104 distinct keys are a draft in at
least one locale and 97 of them are a draft in all three, so one brief serves all
three languages.

---

## 3. WHICH SURFACES ARE AFFECTED

Every surface below shows at least one English string to somebody who chose
Yoruba, Hausa or Igbo. Ordered by how many drafts each carries.

| Surface | Where a person meets it | Drafts | Keys declared here |
|---|---|---|---|
| `paymentsPage` | /settings/payments, the cards and bank accounts screen | 14 | 61 |
| `walletSend` | /wallet/send | 12 | 62 |
| `agentListings` | the agent listing wizard | 11 | 284 |
| `stayDetail` | a Stays property page and its rooms | 8 | 44 |
| `landing` | the public landing page | 7 | 209 |
| `admin` | the admin console | 6 | 547 |
| `offPlatform` | the leaving-Vallo interstitial, on every outbound link | 6 | 6 |
| `walletReceive` | /wallet/receive | 6 | 26 |
| `signUp` | sign up | 5 | 30 |
| `threads` | a conversation, the rental and reservation faces | 5 | 57 |
| `inspectionsPage` | /inspections | 4 | 10 |
| `restaurantPage` | a restaurant page | 4 | 20 |
| `crypto` | the crypto panel | 3 | 46 |
| `settings` | /settings | 3 | 185 |
| `catalogue` | search and listing cards | 2 | 192 |
| `nav` | the dock and the side drawer | 2 | 41 |
| `agent` | the agent workspace navigation | 1 | 137 |
| `counts` | shared count formats | 1 | 5 |
| `home` | the home grid | 1 | 51 |
| `meta` | document metadata | 1 | 3 |
| `stays` | /trips | 1 | 45 |
| `wallet` | /wallet | 1 | 61 |

**The two that matter most are `offPlatform` and the money screens.**
`offPlatform` is six keys of six: the entire leaving-Vallo interstitial, a
safety surface, is English in all three languages. `paymentsPage` and
`walletSend` are twenty six drafts between them, and they are where a person's
money is, which is the worst place on the platform to read a language you did
not choose.

---

## 4. WHAT TO SEND A SPEAKER, EXACTLY

One brief per language, each the same list. Sections 4a and 4b are the work.
Section 4c is not work and is sent with it so the speaker does not spend time on
it.

**The covering note, written so it can be pasted as it stands:**

> These are strings from Vallo, a Nigerian property and hotel app. Each one is
> already in the app in English and is being shown to people who chose YOUR
> language, which is the bug. Please give the natural phrasing a person would
> actually read on a phone rather than a literal translation. Keep anything
> inside curly braces exactly as it is, braces included: `{count}`, `{price}`
> and `{who}` are filled in by the app. Keep the meaning of the money,
> cancellation and safety lines exact; if a sentence cannot be said naturally in
> your language, say so and give the nearest honest wording rather than a
> word-for-word version. Where a word is genuinely the same in your language as
> in English, write it and say so, and we will record that rather than ask
> again.

### 4a. The 57 sentences. These are the whole job.

Every one of these is a complete English sentence sitting inside a Yoruba,
Hausa and Igbo dictionary today.

**`paymentsPage`** (/settings/payments, the cards and bank accounts screen)

- `paymentsPage.accountNumberHint`  
  Ten digits. We show the name on the account before anything is saved.
- `paymentsPage.accountsEmptyBody`  
  Add the account withdrawals should reach. The first one becomes your default.
- `paymentsPage.addCardSub`  
  Tops up your wallet by ₦100 and saves the card for next time. Nothing is lost.
- `paymentsPage.adding`  
  Opening the secure card window. Nothing has been charged yet.
- `paymentsPage.banksFailed`  
  We could not load the bank list. Try again in a moment.
- `paymentsPage.banksNote`  
  Where money you withdraw is paid. We confirm the name with the bank before saving anything.
- `paymentsPage.cardsEmptyBody`  
  Save one and paying next time is one tap. Your card number never touches Vallo.
- `paymentsPage.cardsNote`  
  Your card number never touches Vallo. The processor keeps it and hands us a token for next time.
- `paymentsPage.lede`  
  The cards you pay with and the accounts you are paid into. Nothing here is charged without you.
- `paymentsPage.noLongerUsable`  
  Can no longer be charged
- `paymentsPage.readFailed`  
  We could not load this just now. Nothing has changed. Try again in a moment.
- `paymentsPage.removeAccountBody`  
  Withdrawals can no longer go here. Nothing already sent is affected.
- `paymentsPage.removeCardBody`  
  It is forgotten here and cannot be charged by Vallo again. Your bank is not involved.
- `paymentsPage.signInBody`  
  Cards and bank accounts belong to an account, so this screen needs yours.

**`walletSend`** (/wallet/send)

- `walletSend.consequence`  
  Leaves your wallet the moment you confirm. It cannot be recalled.
- `walletSend.failedTitle`  
  That did not go through
- `walletSend.lede`  
  To another Vallo wallet, by the email on their account. It lands the moment you confirm.
- `walletSend.notEnough`  
  That is more than you have.
- `walletSend.recipientHint`  
  The email they use on Vallo.
- `walletSend.recipientNone`  
  No Vallo account uses this address yet. Check the spelling, or ask them to sign up first.
- `walletSend.recipientSelf`  
  That is your own address. Enter the recipient's.
- `walletSend.sendingBody`  
  This usually takes a few seconds. If it takes longer, your money has not moved and nothing is lost.
- `walletSend.sentBody`  
  Their wallet has it already, and both sides of the movement are in your history.
- `walletSend.signInBody`  
  Sending comes from your own wallet, so it needs your account.
- `walletSend.unreadableBody`  
  We will not take a send against a figure we cannot stand behind. Nothing has moved. Try again in a moment.
- `walletSend.unreadableTitle`  
  Your balance could not be loaded

**`stayDetail`** (a Stays property page and its rooms)

- `stayDetail.everythingIncluded`  
  Everything included. This is what you pay.
- `stayDetail.freeUntil`  
  Free to cancel until {hours} hours before you arrive. Refunds go to your Vallo wallet.
- `stayDetail.maxStay`  
  This rate covers at most {count} nights.
- `stayDetail.minStay`  
  This rate needs at least {count} nights.
- `stayDetail.noRatesYet`  
  This room has no rates loaded yet. Try another room, or message the property.
- `stayDetail.noRoomsYet`  
  The rooms for this property are still being loaded.
- `stayDetail.pickDatesBody`  
  Rates change by night, so the total arrives with the dates. Nothing is held until you reserve.
- `stayDetail.roomsDescription`  
  Tap a room to see its rates and what each one includes.

**`walletReceive`** (/wallet/receive)

- `walletReceive.lede`  
  Anyone on Vallo can send to you from their wallet. Share a request or just your email.
- `walletReceive.recentEmpty`  
  Nothing has come in yet. Share a request and it lands here.
- `walletReceive.shareText`  
  Send me {amount} on Vallo: {link}
- `walletReceive.shareTextNoAmount`  
  Send me money on Vallo: {link}
- `walletReceive.signInBody`  
  Your address for receiving is tied to your account, so it needs you signed in.
- `walletReceive.where`  
  Money sent to {email} lands in this wallet the moment it is sent, and shows in your history straight away.

**`threads`** (a conversation, the rental and reservation faces)

- `threads.rental.declineBody`  
  They will see that you declined. The chat stays open, so you can still explain.
- `threads.rental.offeredByYou`  
  You offered another time. Waiting on {name}.
- `threads.rental.proposeBody`  
  They can take it in one tap. The time they asked for stays on the record.
- `threads.rental.waitingOnYou`  
  They asked to view this place. Your answer goes to them and to their inspections list.
- `threads.reservation.cancelBody`  
  The restaurant will see it as cancelled straight away. You can always book again.

**`inspectionsPage`** (/inspections)

- `inspectionsPage.emptyBody`  
  Request an inspection from a property's page and it lands here, with the answer beside it the moment it comes.
- `inspectionsPage.lede`  
  Every inspection you asked for or were asked to host. Both of you see the same state on the same request.
- `inspectionsPage.openDescription`  
  Your move first, then what is booked in, then what is waiting on them.
- `inspectionsPage.readFailed`  
  We could not load your inspections just now, so this is not showing you an empty list that might not be true. Nothing has been lost. Try again in a moment.

**`restaurantPage`** (a restaurant page)

- `restaurantPage.hoursAsk`  
  Ask them directly and the answer stays in your messages.
- `restaurantPage.hoursUnknown`  
  This restaurant has not published its hours on Vallo yet, so we do not show whether the kitchen is open right now rather than guess at it.
- `restaurantPage.reserveBody`  
  Pick a time and the restaurant answers. Nothing is charged to hold a table.
- `restaurantPage.threadLine`  
  Your reservation and everything said about it stay in one conversation, so the table you booked and the thread about it never disagree.

**`offPlatform`** (the leaving-Vallo interstitial, on every outbound link)

- `offPlatform.body`  
  It goes to {host}. That is not ours and we have not checked what is on it.
- `offPlatform.title`  
  This link leaves Vallo

**`landing`** (the public landing page)

- `landing.appMockLine`  
  Rent, buy or stay. Without the runaround.

**`stays`** (/trips)

- `stays.tripsNothingAhead`  
  Nothing ahead right now. Your past trips are below.

### 4b. The 22 single words and short labels.

| Key | English | Draft in |
|---|---|---|
| `admin.applications.fields.email` | Email | ig |
| `admin.bookings.decidedBy` | {who}, {when} | yo ha ig |
| `admin.listings.propertyType.shortlet` | Shortlet | yo ha ig |
| `admin.listings.propertyType.villa` | Villa | yo ha ig |
| `admin.support.fields.email` | Email | ig |
| `admin.verification.decidedBy` | {who}, {when} | yo ha ig |
| `agent.nav.dashboard` | Dashboard | ha ig |
| `agentListings.propertyTypes.shortlet.label` | Shortlet | yo ha ig |
| `agentListings.propertyTypes.villa.label` | Villa | yo ha ig |
| `crypto.title` | Crypto | yo ha ig |
| `home.browse.shortlet` | Shortlet | yo ha ig |
| `landing.hero.title1` | Real Estate, | yo ha ig |
| `landing.hero.title2` | reimagined. | yo ha ig |
| `landing.slogan` | Real Estate reimagined! | yo ha ig |
| `nav.crypto` | Crypto | yo ha ig |
| `nav.menuLabel` | Menu | ha ig |
| `offPlatform.close` | Close | yo ha ig |
| `offPlatform.copied` | Copied | yo ha ig |
| `offPlatform.copy` | Copy the link | yo ha ig |
| `offPlatform.open` | Open it anyway | yo ha ig |
| `settings.notifications.email` | Email | ig |
| `wallet.home.crypto` | Crypto | yo ha ig |

A note on four of these. `Shortlet`, `Villa` and `Crypto` are English loanwords
that three separate locale files all left as they stand, which is either the
right answer or three people making the same assumption. Ask, and record the
answer either way. `Real Estate, reimagined.` is the product's slogan and may
well be better left in English, which is the founder's call and not a
translator's.

### 4c. The 25 that need no translation, and should not be sent as work.

Brand names, formats, placeholders and one legal name. They count as drafts
because the measure compares text, and text is all it can see.

| Key | Value | Why it stays |
|---|---|---|
| `agentListings.amenities.names.tv` | TV | An initialism in general use. |
| `agentListings.amenities.names.wifi` | WiFi | A brand name in general use. |
| `agentListings.location.addressPlaceholder` | 12 Admiralty Way | An example address. |
| `agentListings.location.areaPlaceholder` | Lekki Phase 1 | A Lagos place name. |
| `agentListings.location.cityPlaceholder` | Lagos | A Nigerian city name. |
| `agentListings.pricing.cleaningPlaceholder` | 10,000 | An example figure. |
| `agentListings.pricing.priceNightPlaceholder` | 85,000 | An example figure. |
| `agentListings.pricing.priceWithPeriod` | {price} {period} | A format string, all placeholders. |
| `agentListings.pricing.priceYearPlaceholder` | 2,500,000 | An example figure. |
| `catalogue.card.sqm` | m² | A unit symbol. |
| `catalogue.detail.morePhotos` | +{count} | A format string. |
| `counts.party` | {adults}, {children} | A format string, all placeholders. |
| `crypto.change24h` | 24h | A time format. |
| `crypto.change7d` | 7d | A time format. |
| `landing.face.footer.legalName` | VALLO SPACES LTD | Rule 14. The registered name is not translated. |
| `landing.face.nav.ai` | AI | An initialism in general use. |
| `landing.face.stays.overline` | Vallo Stays | A product name. |
| `meta.dir` | ltr | A text direction, not a word. |
| `settings.notifications.sms` | SMS | An initialism in general use. |
| `settings.notifications.whatsapp` | WhatsApp | A brand name. |
| `signUp.firstNamePlaceholder` | Ada | An example name. |
| `signUp.hearAbout.instagram` | Instagram | A brand name. |
| `signUp.hearAbout.tiktok` | TikTok | A brand name. |
| `signUp.hearAbout.x` | X | A brand name. |
| `signUp.surnamePlaceholder` | Okafor | An example name. |

---

## 5. WHAT WOULD CLOSE EACH LOCALE, AND WHAT WOULD NOT

**What closes the DRAFT list:** sections 4a and 4b, returned for one language and
pasted into that locale file. That is 79 strings, and it takes the draft count to
zero for that locale. The completeness gate then reads zero for it.

**What that does NOT close:** the five hundred and forty keys the locale never
declared. A locale with zero drafts and 540 undeclared keys still renders a mixed
screen; it just renders one nothing is measuring. The honest statement of where
the three stand today:

| Locale | Declared | Drafts | Genuinely in the language | Shippable |
|---|---|---|---|---|
| Yoruba | 2829 of 3369 | 97 | 2732 | No |
| Hausa | 2833 of 3369 | 99 | 2734 | No |
| Igbo | 2829 of 3369 | 104 | 2725 | No |

**The recommendation.** Send one brief, get one language back, and land it
whole. Three half-finished languages read worse than one finished one with an
honest English beside it, because a person who picks Yoruba and then meets a
payments screen in English learns that the switch does not work.

---

## 6. HOW TO RE-RUN THESE NUMBERS

`localeCompleteness(locale)` in `apps/web/src/lib/i18n/locale-completeness.ts`
returns `{ total, englishValued, englishSentences, englishShare }` for one
locale, and `allLocaleCompleteness()` returns all four. `englishValued` is what
this file calls DRAFTS. The undeclared count is `total` minus
`suppliedKeys(getDictionary(locale)).size`, which that module deliberately does
not report, for the reason its own commentary gives: an undeclared key is a copy
gap and not the smuggled-English defect the gate is for.

This file was produced by reading those two functions rather than by grepping the
locale files, and it should be regenerated the same way rather than edited by
hand when the counts move.
