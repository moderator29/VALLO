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
