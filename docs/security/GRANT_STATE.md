# The grant state of the live database

> **Money, as of 17 October 2026.** Vallo never holds customer money. A wallet, escrow or held payment kept by Vallo itself was retired on 25 September 2026 (Track A), and where this document describes one it describes the past. Since ADR 0003 a licensed partner may hold a payment in escrow, offered only while `protectedRailLive()` reads it as working. The current truth is [`docs/MONEY_ARCHITECTURE.md`](/docs/MONEY_ARCHITECTURE.md).

**Every verdict in this document is a verdict about ONE system: the live
Supabase project `uccixoonmbhrnyczyigt`.** Every privilege below was read from
`pg_class.relacl`, `pg_attribute.attacl` and `pg_proc.proacl` on that project
on **23 September 2026**, through `has_table_privilege`,
`has_column_privilege` and `has_function_privilege`.

**Never `information_schema`.** Its privilege views return only the rows where
the querying role is the grantor or the grantee, so they answer a question
about the observer rather than about the object. A sweep built on them reports
the sandbox and calls it production, which is the same mistake as reading this
container's environment and writing a sentence about the deployment.

**Where a line says UNPROVEN it means exactly that: nobody in this session
observed it.** A line with a probe name beside it was watched happening.

---

## 0. How a refusal was proved, and why the obvious tool cannot do it

`mcp__Supabase__execute_sql` runs as a role with `rolbypassrls` and privileges
of its own. **It can never demonstrate a refusal**; it answers every question
of this kind with a success. Every refusal recorded here was produced through
`mcp__Supabase__apply_migration`, with `set local role <role>` inside a
transaction that ends in a deliberate `raise exception`, so nothing commits.

**And every column of refusals carries a CONTROL in the same transaction that
had to succeed.** A missing column privilege fails the WHOLE select, not just
that column. On 23 September that fact took the entire public catalogue away
from everybody for eleven and a half hours (ledger section 67). A sweep of
refusals with nothing succeeding beside it looks identical to a table nobody
can read any more.

---

## 1. The shape of the estate, counted

117 tables, partitioned tables and views in `public`, on 23 September 2026.

| | `anon` | `authenticated` |
|---|---|---|
| holds a TABLE-WIDE select | 91 | 109 |
| holds a COLUMN LIST and no table grant | 4 | 1 |
| holds nothing at all | 22 | 7 |

The four `anon` reads column by column are `listings`, `businesses`,
`accommodations` and `price_check_shares`. **Two of those four were narrowed
today** and are section 2.

A table-wide grant is Supabase's own default on `public` and is not by itself
a defect. **What makes it one is a broad read policy on top of it over a row
that carries personal data.** That is the shape this sweep looked for.

---

## 2. Closed today

### 2.1 `public.businesses`, narrowed for `anon`

Migration `20260923113850`. Ledger section 68.

`pg_class.relacl` read `anon=arwdDxtm/postgres` and the only read policy,
`businesses_select_published`, is `status = 'PUBLISHED'` applying to PUBLIC. An
anonymous caller could read every column of every published business.

**Nothing was leaking.** Seven rows, all published, and `cac_number`, `tin`,
`representative_name`, `representative_phone`, `email`, `phone`, `address`,
`review_notes`, `reviewer_id` and `registered_name` were null in all seven,
counted on the live project rather than assumed.

| | |
|---|---|
| `anon` may now read | 25 columns: `id`, `owner_id`, `agent_id`, `kind`, `name`, `slug`, `description`, `source`, `status`, `state_code`, `city`, `area`, `latitude`, `longitude`, `location`, `is_demo`, `submitted_at`, `reviewed_at`, `published_at`, `created_at`, `updated_at`, `host_type`, `hygiene_attested_at`, `licence_attested_at`, `verified` |
| `anon` is refused | 12 columns: `address`, `phone`, `email`, `cac_number`, `registered_name`, `tin`, `representative_name`, `representative_phone`, `consents`, `reviewer_id`, `review_notes`, `verification_tier` |
| `authenticated` | the whole table, deliberately, see 4.1 |

Proved, as `anon` and as `authenticated`:

```
BEFORE   0 of 12 withheld columns refused to anon, 5 of 5 control lists green
AFTER   12 of 12 refused to anon, 6 of 6 controls green
```

The controls are the four select lists the product actually issues
anonymously, the admin console's own `BUSINESS_COLUMNS` as `authenticated`, and
`select *` as `authenticated`. The probe is
`scripts/probes/businesses_column_grants.sql`.

**Two application reads had to be narrowed and shipped FIRST**, in commit
`14a92247`, or the revoke would have taken two public pages down with it:
`getStayDetail` asked for `phone, email` and drew neither, and
`getRestaurantDetail` asked for `select("*")` on a page any stranger can open.

### 2.2 `public.accommodations`, narrowed for `anon`

Migration `20260923114336`. **Not in anybody's brief. Found by the sweep.**

The same shape exactly: `accommodations_select_published` is
`status = 'PUBLISHED'` applying to PUBLIC, and the row carries `address` (the
exact street address of a property), `reviewer_id` and `review_notes`.
`public.listings` has withheld all three from `anon` since it was written.

| | |
|---|---|
| `anon` may now read | 26 of 29 columns |
| `anon` is refused | `address`, `reviewer_id`, `review_notes` |
| `authenticated` | the whole table, deliberately, see 4.1 |

```
BEFORE  0 of 3 withheld columns refused to anon, 4 of 4 controls green
AFTER   3 of 3 refused to anon, 5 of 5 controls green
```

`getStayDetail` asked for `select("*")` on this table too and was narrowed
first, in commit `0ac6861b`.

### 2.3 `public.escrow_open`, the retired door, stops holding a key

Migration `20260923115033`. Ledger section 63.5.

`proacl` read `{postgres=X/postgres,service_role=X/postgres}` for a verb
retired in section 59. **Nothing reaches it**, established four ways on the
live project and in the tree before the revoke: 0 of the database's function
bodies mention it, 0 of the 14 `cron.job` rows mention it, the only occurrences
in the repository are the generated `database.types.ts` and the WANTED list in
`scripts/probes/escrow_concurrency.sh`, and the single `.rpc("escrow*")` call
in the whole tree is `escrow_admin_resolve`.

`proacl` now reads `{postgres=X/postgres}`, the same footing
`escrow_fund_from_wallet` and `escrow_fund_from_wallet_as` were left on when
they were retired. The migration's read-back asserts **ten live escrow doors
still hold `service_role`**, because a revoke that took a live door with it
would have read as a clean sweep.

---

## 3. Swept and left alone, with the verdict for each

Seventeen tables in `public` hold personal data (a phone, an email, an
address, a document or tax number, a bank detail, an internal reviewer's note
or a reviewer id) and a grant to `anon` or `authenticated`. Two are section 2.
**The other fifteen are closed by RLS**, and the reason is the same in every
case: every read policy on them tests `auth.uid()` or a staff role, and
`auth.uid()` is null for `anon`, so the wide grant reaches no row.

**None of them is revoked, and that is a decision rather than an omission.** A
revoke of a grant with no demonstrated reach buys nothing and can strand a
surface, which is the mistake in the other direction and the one that cost
eleven hours today.

| Table | Personal columns | `anon` table-wide | Verdict, 23 Sep 2026 |
|---|---|---|---|
| `agent_applications` | `full_name`, `phone`, `email`, `residential_address`, `id_number`, `bank_name`, `account_number`, `account_name`, `reviewer_id`, `review_notes`, `business_*`, `principal_email` | yes | **Closed by RLS.** Both read policies are `user_id = auth.uid()` or a staff role. The widest personal payload on the estate and `anon` reaches no row of it. Worth revoking as defence in depth the day somebody can show no anonymous insert path returns a representation from it. |
| `bookings` | `guest_phone`, `guest_email` | yes | **Closed by RLS.** Guest, host and admin policies, all `auth.uid()` bound. |
| `payout_accounts` | `bank_name`, `account_number`, `account_name`, `bank_code`, `resolved_account_name` | yes | **Closed by RLS.** Admin read plus an agent-ownership existence test. |
| `profiles` | `phone` | yes | **Closed by RLS.** Only `profiles_select_own` and `profiles_select_admin` exist, so this table is not the public social surface; `social_profiles` is. |
| `support_tickets` | `email` | yes | **Closed by RLS.** Own plus admin. |
| `listing_mandates` | `principal_phone` | yes | **Closed by RLS.** `private.owns_listing(listing_id)`, which is false for `anon`. |
| `listing_access` | `security_phone` | yes | **Closed by RLS, and doubly.** The policy calls `private.can_see_listing_access(uuid)`, which `anon` cannot even evaluate; `supabase/tests/probes/db-20.sql` reports it as a live gap (DB-20). An anonymous read raises 42501 rather than returning a row. |
| `bot_invocations` | `input_tokens`, `output_tokens` | yes | **Not personal data.** These are model token counts, matched by the name sweep and cleared by reading them. Policy is `auth.uid()` bound anyway. |
| `bank_accounts` | `account_number`, `bank_code`, `bank_name`, `resolved_account_name` | no | **Closed twice.** `anon` holds nothing at all, and the policies are own plus admin. |
| `business_verification_checks` | `reviewer_id` | no | `anon` holds nothing. Owner plus admin. |
| `payment_methods` | `bank`, `email_used` | no | `anon` holds nothing. Own plus admin. |
| `push_tokens` | `token`, `device_ref`, `device_label` | no | `anon` holds nothing. Own only. |
| `push_deliveries` | `token_id`, `device_ref` | no | `anon` holds nothing. Staff only. |
| `push_queue` | `claim_token` | no | `anon` holds nothing. Staff only. |
| `listings` | `address`, `reviewer_id`, `review_notes` | no, column list | **Already correct**, and it is the pattern the two narrowings above copied. |

### 3.1 Two views that `anon` reads and RLS does not cover

`public.listing_lister` and `public.person_badge` are views with
`relrowsecurity = false`, each granted `r` to `anon` and `authenticated`, each
two columns wide. **A view is not protected by RLS on itself**; it is protected
by what it selects and by whether it is `security_invoker`. Both exist to
publish exactly one public fact (a lister's name, a badge tier) and neither
carries a personal column.

**UNPROVEN:** whether either view is `security_invoker`, and therefore whether
it can be used to read a base table's rows past that table's own policies. It
was not read in this session. **This is the one thing on this page most worth
somebody's next hour**, because a non-invoker view over a narrowed table is a
way round the narrowing.

---

## 4. The deliberate exceptions, each with its reason

### 4.1 `authenticated` keeps the whole table on `businesses` and `accommodations`

**This is the most important line in this document, because it is a residual
exposure and not a clean close.**

`businesses_owner_all`, `businesses_admin_all`, `accommodations_owner_all` and
`accommodations_admin_all` are permissive policies on the same tables. An owner
reads its own RC number and its own representative through the first pair; the
KYC desk reads `review_notes` and `reviewer_id` through the second. Both run as
`authenticated`. **A column privilege cannot be made row-conditional**, so
narrowing `authenticated` would strand the host workspace and the admin
console.

**The residual fact, stated rather than hidden: any signed-in account can read
a published firm's personal columns.** Not an anonymous stranger, but any
account. Closing that needs a redacting view or a function, it changes what a
screen can show, and **it is a product decision rather than a grant.** It is
named here so it is a decision somebody took rather than something nobody
noticed.

### 4.2 Policy callers anon cannot evaluate (no allowlist any more)

The old hand-run probe allowlisted three pairs for `anon`. Its replacement,
`supabase/tests/probes/db-20.sql`, reads the functions from `pg_depend` and
honours each policy's roles (`pg_policy.polroles`), so pairs anon never
evaluates (`attachment_path_access`, `escrow_evidence_path_access`: their
policies are `to authenticated`) are no longer counted, and it has no
allowlist. On 23 September it reports exactly three live gaps, all `anon`:
`private.can_see_listing_access(uuid)` on `listing_access.listing_access_select`
and `private.inspection_photo_path_access(text,boolean)` on the two
`inspection_photos_objects_party_*` policies on `storage.objects` (DB-04,
DB-20). The fix is to scope those policies `to authenticated`; the probe stays
red until then.

### 4.3 The 22 load-bearing `private` grants

Ledger section 53. 152 RLS policies across 88 tables call `private.*`
functions, and **a policy expression is evaluated as the querying role**, so
those functions must stay executable by `anon` and `authenticated`. They are
not a defect. Revoking them is what caused today's eleven hour outage.

---

## 5. SECURITY DEFINER functions, and who holds EXECUTE

Read from `pg_proc.proacl` on the live project, 23 September 2026.

| | `public` | `private` |
|---|---|---|
| SECURITY DEFINER functions | 90 | 223 |
| of which trigger functions | 7 | 122 |
| `anon` holds EXECUTE | 3 | 56 |
| `authenticated` holds EXECUTE | 21 | 62 |
| `service_role` holds EXECUTE | 84 | 38 |
| no ACL at all, which means EXECUTE to PUBLIC | 0 | 34 |

### 5.1 The three `public` verbs `anon` may execute

`public.is_checked_person(uuid)`, `public.is_platform_staff(uuid)` and
`public.platform_stats()`. The first two are RLS helpers of exactly the class
section 53 protected; the third produces the statistics band and carries
`not is_demo` inside itself. **Deliberate.**

### 5.2 The 21 `public` verbs `authenticated` may execute

Read and named on 23 September. Thirteen of them are staff verbs:
`admin_expire_stale_withdrawal_holds`, `admin_payment_health`,
`admin_retire_demo_listings`, `admin_revenue_summary`,
`admin_user_id_by_email`, `review_kyc_document`, `set_fee_rate`,
`escrow_admin_resolve` and the rest. **They are executable by every signed-in
account**, which is only safe if each one tests the caller's role INSIDE
itself.

**UNPROVEN: this session did not read those thirteen bodies.** Section 53 found
five functions in `private` that "believe whoever calls them about who is
calling", and these are the same shape in the schema PostgREST actually
exposes. **This is the next piece of work on this page.** It is named rather
than done, and nothing here claims they are safe.

### 5.3 The 37 `private` trigger functions: CLOSED, and EXECUTE does not matter

Ledger section 53 named 38 trigger functions with no ACL and asked for "one
observation first: a trigger firing as `authenticated` with the grant removed".
**Today the live count is 37, not 38.** They are the only reason `anon` and
`authenticated` appear against so many `private` functions.

**The observation was taken on the live project, in a throwaway schema inside a
transaction ending in a deliberate raise, so nothing persisted and no product
table was touched:**

```
PROBE trigger-execute: acl after the revoke = {postgres=X/postgres};
  trigger fired as authenticated                        -> [the trigger ran]
  CONTROL, same role calling it directly                -> [REFUSED (42501)]
```

The control is the whole point: it proves the revoke took, so the first line is
evidence rather than an artefact.

**Verdict: PostgreSQL does not check EXECUTE when firing a trigger, measured
rather than quoted. Revoking on the 37 would change nothing that can be
observed.** A trigger function returns `trigger` and cannot be usefully called
any other way. **The item is closed rather than made to look closed by a
ceremonial migration**, which is what the ledger asked for.

129 of the 130 `private` trigger functions are wired to a live trigger. **One
is not**, which nobody has looked at. UNPROVEN which, and whether it is dead
code or a trigger somebody dropped.

### 5.4 `private.open_place_entries(areas)`: NAMED, NOT CLOSED, and why

The one non-trigger function in `private` with **no ACL at all**, which in
PostgreSQL means EXECUTE to PUBLIC. It is SECURITY DEFINER, VOLATILE, it
WRITES rows, and it is called by 0 RLS policies. Its only caller anywhere in
the database is `private.open_place_entries_trg()`, which is itself SECURITY
DEFINER.

**It is not reachable over the API today**: PostgREST exposes `public` on this
project, not `private`. That is the same distance section 53 recorded for the
nine it closed, and the same distance rule 21 exists to keep.

**It was NOT revoked, and the reason is that my proof broke.** The probe
written to watch a definer trigger call a revoked definer helper failed on a
TABLE privilege inside its own throwaway harness before it could answer the
EXECUTE question:

```
PROBE definer-chain: helper acl = {postgres=X/postgres};
  insert as authenticated  -> [REFUSED: permission denied for table written]
  CONTROL, direct call     -> [REFUSED (42501), so the revoke took]
```

The control passed and the measurement did not, so **the run says nothing about
whether the revoke is safe**, and a revoke on a writing function taken on a
belief about the manual is exactly what this repository keeps paying for.
**Repair the harness, re-run it, then revoke.** Recorded as owed rather than
done.

---

## 6. The four "unexplained" live function bodies: EXPLAINED

Ledger section 63.3 recorded four live bodies that differ from their migration
text by stripped `--` comments and wrote **UNEXPLAINED** against each, with the
sentence "something edits this database outside a migration and nobody has
found what."

**Nothing edits this database outside a migration.** Measured on the live
project, 23 September 2026, from `supabase_migrations.schema_migrations`, whose
`statements` column holds the text Supabase actually applied:

| Function | A recorded migration whose applied text contains the live body VERBATIM |
|---|---|
| `private.compute_fee` | `20260809051502` |
| `private.notify` | `20260804134543` |
| `public.move_into_pot` | `20260922125650` |
| `private.escrow_invariants_check` | `20260922224436` |

**All four, verbatim, in a migration the database itself recorded as applied.**

**The divergence is in the repository, not in the database.** The applied
statement for `20260809051502` is 7,201 characters and contains **zero** `--`
comments; the file on disk under that name is 14,918 characters and contains
**303**. `move_into_pot`'s applied statement is 8,400 characters with zero `--`;
its file is 15,981 with 126.

**The mechanism is the house procedure.** A worker composes a compact statement
for `apply_migration`, and then writes a fuller, annotated file to disk under
the recorded version. The database never saw the prose. The signature is
exactly what was observed: identical code, comments only in the file.

**And a second finding nobody was looking for: the filenames on disk do not
match the versions the database recorded.** Three of the six files checked:

| File on disk | Version the database recorded |
|---|---|
| `20260812090100_pots_move_money_under_the_wallet_lock` | `20260922125650` |
| `20260923011000_the_float_identity_is_asserted_on_a_schedule` | `20260922224436` |
| `20260919101500_b4_a_stay_notification_lands_on_the_stays_side` | `20260919171510` |

The rule is apply first, then rename the file to the recorded version, and for
these three it was not followed. **This matters beyond tidiness**, because the
ESCROW4 catalogue guard decides "defining migration newer than the live head"
from the filename, and for these files the filename is a guess rather than a
fact.

Every one of the 293 rows in `schema_migrations` carries the same
`created_by`, a single account. **No dashboard author, no second writer.**

---

## 7. What this page does not cover

- **Storage policies and `storage.objects`.** Not swept. UNPROVEN.
- **The `auth` schema.** Supabase's own. Not swept.
- **Write privileges.** This page is about reading. `anon` retains Supabase's
  default `awdDxtm` on most of `public`, and every write is gated by RLS
  policies that test `auth.uid()`, which is null for `anon`. **No write path
  was exercised in this session.** UNPROVEN as a class.
- **Anything on a screen.** This container's egress proxy refuses
  `CONNECT uccixoonmbhrnyczyigt.supabase.co:443`, so no page was loaded. Every
  verdict here is a verdict about the database, taken from the database. **One
  reload of the live stay page and the live restaurant page closes the last
  gap on section 2**, and until somebody does that, the claim that those two
  surfaces still render is UNPROVEN.

---

## 8. The check that guards all of this

`supabase/tests/probes/db-20.sql` (it replaced `scripts/probes/policy_callers_hold_execute.sql`,
which matched function names as text and ignored policy roles). Every RLS policy
joined, through `pg_depend`, to whether each role the policy applies to holds
EXECUTE on each function it calls. It runs with every other probe through
`scripts/db-probes/run.mjs` (CI job "Database probes"). The run recorded below
is the old probe's. **Run before and after every revoke in this session's work**, four
times in total, and identical every time:

```
371 pairs examined, 366 hold EXECUTE, 3 allowlisted, 0 unexplained
```

Run with the allowlist emptied it flags 5 of 371, so it bites.

`scripts/probes/businesses_column_grants.sql` is the new one and it guards the
other half: the twelve refusals AND the four select lists the product issues
anonymously, in one transaction, because a column of refusals without a control
beside it is a table nobody can read any more.
