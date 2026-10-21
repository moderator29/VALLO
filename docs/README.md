# Vallo documentation

This index lists the live documentation, grouped by what you are trying to do. When a document disagrees with the code or the database, the code and the database are right, and the document should be fixed in the same change that finds the error.

Read [`../HANDOFF.md`](../HANDOFF.md) first: it is the only handoff and carries the product rules, the company facts and how work is done. For setup, architecture and the repository layout, see the [repository README](../README.md).

Retired material (old session handoffs, dated sweeps and audits, research notes and the founder's prompt corpus) was deleted on 17 October 2026 and is not to be recreated. Anything in git history before that date is history, not guidance. Do not add plans, ledgers, dated reports or status files to `docs/`: that record belongs in commit messages.

## Understand the product

| Document | What it is for |
|---|---|
| [PRODUCT.md](PRODUCT.md) | What Vallo is, who it serves, what a listing is, who can do what, and the vocabulary. Read it first |
| [DECISIONS_2026-10-13.md](DECISIONS_2026-10-13.md) | The founder's decisions of 13 October 2026, each with its status in the code, plus how viewings, listing media, host setup, restaurants and no-show disputes work. Read before changing fees, viewings or host rules |
| [RULINGS.md](RULINGS.md) | The founder's rulings D51 to D85 that are still in force, one line each, and which ones were retired. Code comments cite them by number |
| [ONE_PERSON_MANY_ACCOUNTS.md](ONE_PERSON_MANY_ACCOUNTS.md) | How one person holding several accounts or workspaces is handled at each gate |
| [BADGES.md](BADGES.md) | Earned badges for agents and members, and what a badge does and does not mean |
| [SOCIAL_DESIGN.md](SOCIAL_DESIGN.md) | The design record for the social layer (Around) |
| [SUCCESS_MOMENTS.md](SUCCESS_MOMENTS.md) | Every success moment in the product and how each is shown |
| [BACK_NAVIGATION.md](BACK_NAVIGATION.md) | Where the back button goes, and the rules behind it |
| [PASSCODE.md](PASSCODE.md) | The "Welcome back" passcode lock: setup, storage, the lock and its cookie, brute force, forgot and change |
| [PHONE_SIGNIN.md](PHONE_SIGNIN.md) | Signing in with a phone number |

## Decisions

| Document | What it is for |
|---|---|
| [ARCHITECTURE_DECISIONS.md](ARCHITECTURE_DECISIONS.md) | ADR-001 to ADR-014 in one file |
| [adr/0003-a-licensed-provider-holds-the-money-vallo-records-it.md](adr/0003-a-licensed-provider-holds-the-money-vallo-records-it.md) | **Current.** A licensed provider holds the money; Vallo records it. Escrow, balances, deposits and withdrawals are built, Payluk holds the funds, Vallo never takes custody, and the custody naming guard stays (amends ADR 0002) |
| [adr/0004-two-rails-direct-and-provider-held-escrow.md](adr/0004-two-rails-direct-and-provider-held-escrow.md) | **Current, subordinate to ADR 0003.** Which rail a payment takes: direct settlement by split for fixed-price bookings, provider held escrow for negotiated deals, chosen by data in `payment_rail_policy` |
| [adr/0002-vallo-never-holds-customer-money.md](adr/0002-vallo-never-holds-customer-money.md) | Vallo never holds customer money (supersedes ADR 0001, amended by ADR 0003 and 0004) |
| [adr/0001-held-payments-custody-purpose-and-the-float.md](adr/0001-held-payments-custody-purpose-and-the-float.md) | Superseded: held payments (escrow), kept as an ADR record only |
| [design/ONE-PRODUCT-DECISIONS.md](design/ONE-PRODUCT-DECISIONS.md) | The one-product decisions: shared primitives over per-page inventions |

## Money

| Document | What it is for |
|---|---|
| [MONEY_ARCHITECTURE.md](MONEY_ARCHITECTURE.md) | **How money moves now**: the status block at the top is the current truth (escrow by a licensed partner, the Guarantee retired, the switches live), then the split-at-payment mechanism |
| [payments/VALLO_PRICING.md](payments/VALLO_PRICING.md) | What Vallo charges and what the provider charges: the commission as policy data, the retired Guarantee, why no VAT yet, the withdrawal bands and the referral economics |
| [payments/VALLO_FINANCIAL_LAYER.md](payments/VALLO_FINANCIAL_LAYER.md) | Vallo presents, the provider holds: what Payluk provides endpoint by endpoint, the four conditions under which a balance surface is legal, and the provider abstraction |
| [payments/VALLO_PAYMENTS_ARCHITECTURE.md](payments/VALLO_PAYMENTS_ARCHITECTURE.md) | Paystack, Payluk and Yellow Card: the provider interface, the ledger, the two tracks and the legal gate. Section 0 is an evidence warning that must be read before any Payluk code |
| [payments/PAYLUK_LIVE_DOCS_FINDINGS.md](payments/PAYLUK_LIVE_DOCS_FINDINGS.md), [payments/payluk-source/](payments/payluk-source/) | What Payluk's live documentation actually says, and the saved source pages the client is written against |
| [payments/RELEASE_RUNBOOK.md](payments/RELEASE_RUNBOOK.md) | The steps that open the escrow rail in production |
| [ROOM_CHECKOUT.md](ROOM_CHECKOUT.md) | Hotel rooms: how a guest requests and pays for a room, how the host is paid, test mode, switching `room_bookings` on |
| [promotion/VALLO_PROMOTION.md](promotion/VALLO_PROMOTION.md) | Paid promotion: the tiers, what each buys, and the rules the placements obey |
| [referral/REFERRAL_ARCHITECTURE.md](referral/REFERRAL_ARCHITECTURE.md), [referral/REFERRAL_ADMIN_CENTRE.md](referral/REFERRAL_ADMIN_CENTRE.md) | The referral engine (attribution, qualification, risk graph, budget cap) and its admin centre |

## Run and deploy it

| Document | What it is for |
|---|---|
| [ENVIRONMENT.md](ENVIRONMENT.md) | Every credential the code reads, what breaks without it, and where to get it (a unit test reads this file) |
| [DEPLOY.md](DEPLOY.md) | The deploy runbook: Vercel, Supabase dashboard steps, Paystack, cron secrets, launch checklist (a unit test reads this file) |
| [ADMIN_CONSOLE.md](ADMIN_CONSOLE.md) | The operations handbook for the admin console, including the pg_cron job table (a unit test reads this file) |
| [DB_NOTES.md](DB_NOTES.md) | Database statements the connector cannot run, for the founder to paste |
| [db/SUPERSEDED_MIGRATIONS.md](db/SUPERSEDED_MIGRATIONS.md) | Migrations in the folder that the live database never ran as written, and why |
| [sql-editor/01-cleanup-now.sql](sql-editor/01-cleanup-now.sql) | One paste for the Supabase SQL editor: the purges and drops the connector refuses |
| [sql-editor/02-health-check-read-only.sql](sql-editor/02-health-check-read-only.sql) | Read-only health checks for the Supabase SQL editor: the advisor pass the 17 October audit could not run |
| [security/GRANT_STATE.md](security/GRANT_STATE.md) | The grant state of the live database |
| [schema/NAMES.md](schema/NAMES.md) | Schema names that mislead, and what they actually hold (a unit test checks it) |
| [ONBOARDING_A_RESTAURANT.md](ONBOARDING_A_RESTAURANT.md) | What to collect from a restaurant owner, and why |
| [SUPPORT_STAFF.md](SUPPORT_STAFF.md) | What support staff can see and do |
| [safety/BLOCKED_TERMS_PROPOSAL.md](safety/BLOCKED_TERMS_PROPOSAL.md) | The starter list for the abuse filter |
| [video-calling/](video-calling/VIDEO-CALLING-ARCHITECTURE.md) | Video calls: architecture, API contracts, admin reviews, security and privacy, mobile compatibility, the provider decision and the production checklist |

## Compliance and legal

| Document | What it is for |
|---|---|
| [COMPLIANCE_RUNBOOK.md](COMPLIANCE_RUNBOOK.md) | What staff do for each AML/CFT (SCUML) obligation, and in what order |
| [COMPLIANCE_SCUML.md](COMPLIANCE_SCUML.md) | The SCUML registration and what it obliges |
| [AML_COMPLIANCE_GAP.md](AML_COMPLIANCE_GAP.md) | Where the AML controls stand against the obligations |
| [LEGAL_AND_NDPC_READINESS.md](LEGAL_AND_NDPC_READINESS.md) | Legal pages and Nigeria Data Protection readiness |
| [RETENTION_SCHEDULE.md](RETENTION_SCHEDULE.md) | Data retention and destruction schedule (Nigeria Data Protection Act 2023) |
| [SUBJECT_ACCESS.md](SUBJECT_ACCESS.md) | How a person gets a copy of their data: the self-serve export and the by-request route |

## Mobile

| Document | What it is for |
|---|---|
| [MOBILE.md](MOBILE.md) | Building, signing and shipping the iOS and Android apps |
| [MOBILE_READINESS.md](MOBILE_READINESS.md) | Why the native apps load the live origin, and store posture |
| [NATIVE_CI.md](NATIVE_CI.md) | The Android and iOS build workflows and the secrets they need |
| [VALLO_IOS_RELEASE_CHECKLIST.md](VALLO_IOS_RELEASE_CHECKLIST.md), [VALLO_ANDROID_RELEASE_CHECKLIST.md](VALLO_ANDROID_RELEASE_CHECKLIST.md) | Release checklists per platform |
| [VALLO_NATIVE_RELEASE_AUDIT.md](VALLO_NATIVE_RELEASE_AUDIT.md), [VALLO_NATIVE_TEST_MATRIX.md](VALLO_NATIVE_TEST_MATRIX.md) | The native release audit and the device test matrix |
| [FOUNDER_DEVICE_TEST_BRIEF.md](FOUNDER_DEVICE_TEST_BRIEF.md) | What the founder checks on a real phone |
| [STORE_SUBMISSION_NOTES.md](STORE_SUBMISSION_NOTES.md) | Decisions taken for App Store and Play Store submission |
| [store/FOUNDER_CHECKLIST.md](store/FOUNDER_CHECKLIST.md), [store/FOUNDER_STEPS.md](store/FOUNDER_STEPS.md) | The founder's store steps, in plain language, and the console click paths |
| [store/LISTING_COPY.md](store/LISTING_COPY.md), [store/PRIVACY_LABELS.md](store/PRIVACY_LABELS.md) | Store listing copy and the store privacy answers (a unit test reads the labels) |
| [store/APP_STORE_SCREENSHOTS_HANDBOOK.md](store/APP_STORE_SCREENSHOTS_HANDBOOK.md) | The store screenshots: what to submit, how each was made, how to regenerate them |

## Notifications and email

| Document | What it is for |
|---|---|
| [NOTIFICATIONS_MAP.md](NOTIFICATIONS_MAP.md) | Every event, who is told, how, and what is still missing (a unit test reads this file) |
| [push/FIRST_NOTIFICATION.md](push/FIRST_NOTIFICATION.md) | See a push notification work end to end |
| [push/THE_FORTY_EVENTS.md](push/THE_FORTY_EVENTS.md) | Every notification event, walked through |
| [email/WHAT_SENDS.md](email/WHAT_SENDS.md) | What sends email, what refuses, and what is unproven |
| [email/AUTH_EMAILS.md](email/AUTH_EMAILS.md) | The authentication emails: the Send Email Hook route, the templates and their design |
| [../supabase/README.md](../supabase/README.md) | The auth email templates: how to generate and apply them |

## Design

| Document | What it is for |
|---|---|
| [design/PREMIUM-STANDARD.md](design/PREMIUM-STANDARD.md) | **The bar every screen is built to** (D72, D74, D78): the governing references, decoded |
| [design/MOTION_SYSTEM.md](design/MOTION_SYSTEM.md) | The motion specification: the moment inventory, the startup sequence, Get Started and the passcode |
| [design/CLEAN_UNIFIED_DIRECTION.md](design/CLEAN_UNIFIED_DIRECTION.md) | The clean unified direction the shared components follow (cited by the component comments) |
| [design/COMPONENTS.md](design/COMPONENTS.md), [design/COMPONENT_LIBRARY.md](design/COMPONENT_LIBRARY.md) | The component families, and the porting rules for the ported components |
| [design/CRAFT_DOCTRINE.md](design/CRAFT_DOCTRINE.md) | The taste standard: one screen one idea, and the questions a screen answers before it ships |
| [design/VOICE.md](design/VOICE.md) | How the product speaks in empty, loading, offline, failed and done states |
| [design/CATALOGUE.md](design/CATALOGUE.md) | An index of every reference image in `design/references/` |
| [design/LIGHT_MODE_REMOVED.md](design/LIGHT_MODE_REMOVED.md) | History: why light mode was removed on 23 September 2026. It was restored on 25 September and ships today (Light, Dark or System, default Dark) |
| [DESIGN_DIRECTION.md](DESIGN_DIRECTION.md) | The earlier design direction, kept because code comments cite it; where it meets `design/PREMIUM-STANDARD.md` or the rulings D78, D81 and D82, those win |
| [design/GLOW_IDENTITY.md](design/GLOW_IDENTITY.md) | The glow system, measured. Kept because stylesheet comments cite it; glass is gone from icons, logo and controls (D78, D82) |
| [BRAND_MARKS.md](BRAND_MARKS.md) | The brand marks. The glass marks it measures are retired; the current logo is the D81 artwork, one colour set on every ground (D82) |
| [ICON_SYSTEM.md](ICON_SYSTEM.md) | The icon tiers and their rules |
| [IMAGERY.md](IMAGERY.md) | Photography shortlist and licences |
| [i18n/LOCALE_STATE.md](i18n/LOCALE_STATE.md) | The state of the Yoruba, Hausa and Igbo drafts |

## Marketing

[marketing/](marketing/) holds the launch campaign, the device showcase, the two videos and their source screenshots, with [marketing/DELIVERY-2026-10.md](marketing/DELIVERY-2026-10.md) as the record of what was delivered.

## The founder in his own words

[sessions/founder-corpus/](sessions/founder-corpus/README.md) keeps the two founder notes the money rules still rest on: why Vallo never holds customer money, and why no provider may leak into the experience.

`design/proofs/` is ignored by git. Screenshot runs written there by the scripts in `scripts/design/` stay on the machine that made them.
