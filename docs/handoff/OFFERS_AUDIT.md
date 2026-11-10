# OFFERS AND DEAL ROOM: AUDIT LOG

Written before any code, 10 November 2026 (section 14 step 1 of
`OFFERS_AND_DEAL_ROOM.md`). Later passes append under their own headings.

## STEP 1. THE SOURCE AUDIT

Every claim in section 2 of the handoff was checked against the migrations and
the app. Verified unless marked.

### Confirmed as written

| Claim | Where it was read |
|---|---|
| `deal_agreements` shape, `terms_version`, the two confirmed-version columns, `mandate_id`, `inspection_id` and `booking_id` unique and nullable | `20260925121219_track_a2_...agreements_claims.sql` lines 129-160 |
| `agreement_status` is `('awaiting_parties','in_review','approved','rejected','cancelled','paid')` | same file, line 129 |
| `deal_agreement_versions` + trigger `private.snapshot_agreement_version()` | `20260930084615_b9_...sql` |
| `deal_agreement_events` is append-only (`private.history_is_fixed`) | A2 file, line 195 |
| No unique constraint on `listing_id`, so many agreements per listing | A2 file, indexes |
| Rent amend lapses every confirmation and bumps `terms_version`; confirm is per version and rejects `terms_changed` | `agreement_amend_as`, `agreement_confirm_as` |
| Privileged writers are definer-only, `EXECUTE` revoked from clients | `20260929012950_...sql` |
| Sales are listings and leads only: no offer, counter, room, inbox, vault | grep of `lib`, `app`, migrations |
| Inspections, `listing_mandates (kind letting/sale/management)`, `identity_checks`, notifications, console step-up exist | migrations, `lib/` |

### Differences from the handoff (the code is right)

1. **The listing intent column is `listing_intent`, not `intent`.** The sale
   price is `listings.sale_price_minor`. All new SQL uses the real names.
2. **The seller side is `agents.user_id`**, reached through `listings.agent_id`
   (the same way `agreement_open_rent_as` finds the lister). A listing owned by
   a firm is reached through the agent. `owner_id` on the agreement is the
   lister's user id.
3. **`deal_agreement_events.action` has a CHECK** listing eight actions. Sale
   needs more (`countered`, `declined`, `withdrawn`, `expired`,
   `info_requested`, `info_provided`, `stage`, `disputed`, `document`,
   `intervened`). The constraint must be replaced, additively.
4. **`deal_agreement_versions` is readable by the two parties only**, not by
   staff. Staff read through an audited definer function, not a policy.
5. **`private.staff_can(user, scope)` ignores the scope**: it is
   admin-or-super-admin. The Offers desk uses it unchanged (existing RBAC), and
   writes `audit_log` plus a step-up check for any intervention.
6. **`deal_agreements_rejection_has_reason`** forces a reason on `rejected`. A
   seller's decline reason is optional in the specification, so the definer
   writes a stock sentence when none is given.
7. **`amount_minor > 0`** is a column check, so an offer can never be zero or
   negative, and "blank means asking price" must be resolved to the real figure
   before insert.
8. **The agreement confirm function treats mandates as all or nothing**
   (`has_mandates` any kind). Sale offers use their own function and require a
   live `kind = 'sale'` mandate when the lister is not the owner of record.

### Missing, as the handoff says

- `kind = 'sale'`, `withdrawn` and `expired` statuses, offer expiry, the sale
  guard on `paid`, `deal_documents`, the Deal Room, the two dashboards, the
  admin desk, the expiry job.

### Not in the repository (found by this audit, not in the handoff)

- **The documentation kit does not exist.** `DOCS_AND_PRESENCE_UPGRADE.md` is a
  handoff only: there is no `DocCard`, `DocTable`, `DocCallout`, `DocToc`, no
  step player and no docs shell. The docs live in `app/(site)/docs`
  (chapters), `(site)/guides` and `(site)/help`. The docs agent builds the kit
  first, then every page on it.
- **There is no screenshot capture harness and no Supabase credentials in
  this container.** Real signed-in captures of live data are impossible here.
  The honest substitute, and what is built: every new screen has a preview
  fixture page under `app/(dev)/preview/offers/**` that renders the real
  component with typed fixture data, and the captures come from those, both
  themes. Docs say "example screens" under each capture. No capture is claimed
  to be a live account.
- **`node_modules` was absent**; installed with `npm ci` for this session.

### Banner art (founder's side report, same message)

The NYSC accommodation community cover crops the woman's face. Cause: the slot
`circlePromo` is a transparent-ground cut-out (`fit: "contain"`) but
`CommunityScreen.tsx` draws it with `objectFit: cover`, so the head is cut off
at the banner edge. The same mismatch can occur anywhere an art slot is drawn
without honouring `fit`. All seven art slots are audited in the banner fix.

### Decisions taken

- No new offers table. A sale offer is `deal_agreements.kind = 'sale'`.
- New columns on `deal_agreements`: `expires_at`, `sale_stage`,
  `awaiting_side`, `idempotency_key`, `disputed_at`, `agreed_version`.
  New tables: `deal_documents`, `deal_document_access` (the access log).
  Everything else reuses.
- `approved` on a sale means **terms agreed**, never sold. The interface says
  "Terms agreed" and the stage tracker says what is still to happen.
- Eligibility is configured in one table, `offer_requirements` (per listing
  category, with a default row), not hardcoded.

---

## PASS ONE: CORRECTNESS (10 November 2026)

Walked every numbered requirement in `OFFERS_AND_DEAL_ROOM.md` against the
code and the tests that ran, not against memory. The founder's own written
specification was not in the message text (only the screenshots arrived), so
the handoff, which restates it, is the checklist. If his text differs, his wins.

### Requirement walk

| Req | State | Evidence |
|---|---|---|
| 3 No new offers table; kind = 'sale' on deal_agreements | done | offers_01; no property_offers etc. |
| 3.1 withdrawn, expired; paid unreachable for sale | done | constraint `deal_agreements_sale_takes_no_money`; e2e proves paid and in_review refused |
| 3.2 deal_documents; disputes reuse reports | done | offers_03; dispute inserts into `public.reports` |
| 4.1 eligibility gate shape, blank amount, 3 payment prefs, closing date, note, honest line | done (fixtures) | OfferFlow, seen at 390/360 against fixtures |
| 4.2 honest price block, no invented fee | done | `priceBlockOf`: asking only, no costs, no total; map.test |
| 4.4 mandate line, inspection report, Deal Room | partly | mandate line done; eight-item report NOT read into the room (links to the visit flow) |
| 5.1 sticky bar, gate, form, summary, idempotent submit, confirmation | done (fixtures) | e2e: replay returns same offer; two live offers refused |
| 5.2 inbox, detail, four responses, accept confirmation | done (fixtures) | e2e covers accept, decline, counter, info |
| 6 Deal Room tabs | partly | Overview, Negotiation, Documents, Activity built; **Messages links out instead of embedding; Inspection links out** |
| 7 what may be said | done in words.ts, docs and emails | grep of offers UI and docs: no "verified" about documents, no deposit/secure, no "sold" |
| 8 documents states, private storage, signed access, logged | done in SQL and actions | e2e: stranger refused, access logged, foreign path refused |
| 9 server-validated, locked, idempotent, rate limited, audit | done | e2e plus race.sh (one agreement, one approval event) |
| 10 admin desk, real metrics, no revenue, intervention cannot rewrite terms | done | reads filled; terms-fixed trigger; e2e |
| 11 design in both themes | partly | dark checked widely; light checked on flow, confirmation, Deal Room only |
| 12 documentation | done | 8 offers pages + staff page, buttons from routes.ts, 5 guide steps captured both themes |
| 13 sweep + test left behind | done | coverage.test fails on a fake route (proved) |
| 14.11 notifications and emails | done | 13 templates, registered, test updated; dedupe by key |
| 14.12 jobs | done | offers-sweep cron, freshness and handbook rows, proxy allowlist |
| 15 tests | partly | SQL e2e + race, vitest. **No browser test of the full journey against a live database exists** |

### Findings

| # | Finding | Severity | Disposition |
|---|---|---|---|
| P1-1 | **Counteroffer sheet did not send the version it was looking at.** The action defaulted to "the current version" read at call time, so a buyer reading v2 who answered after a v3 arrived would counter v3 unseen. | high | **Fixed**: `baseVersion` is now required end to end; the sheet passes `room.offer.version`. |
| P1-2 | System-worded cards ("New offer VO-...") were posted into the thread as if the person wrote them, and each triggered a second "new message" notice beside the Deal Room notice. | medium | **Fixed**: removed. Only a person's own words (the seller's question, the buyer's answer) enter the thread. Structured cards in the thread are therefore **deliberately not built**; the Activity tab carries the events. |
| P1-3 | The existing `agreement_cancel_as` door can be called on a sale (it is kind-agnostic) so either party can cancel an agreed deal without the "withdrawn" word. | low | Left, recorded: either side may walk away from an agreed deal before completion, and it is logged as `cancelled` with the actor. The UI does not offer it; withdraw is the door. |
| P1-4 | Admin deal view labels every event actor "seller" (the admin detail function returns a name, not a side) and shows no per-version confirmation. | low | Left for pass three; the desk shows names, which is what staff need. |
| P1-5 | Messages tab and Inspection tab link out rather than embed (needs a reusable thread panel and an eight-item report read). | medium | Left, reported to the founder: this is a gap against "Messages: in place". |
| P1-6 | `/verification` ignores a return path, so Fix returns by Back with the draft kept in sessionStorage. | low | Left: works, but is not the "comes back to the offer" redirect. |
| P1-7 | The full vitest suite and tsc had not been run on the merged tree. | process | Run: see the gate block at the end of this pass. |

### Fix and gates

P1-1 and P1-2 fixed; local database tests re-run (E2E_OK, RACE_OK).
