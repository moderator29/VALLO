# Vallo pricing: what Vallo charges, what the provider charges, and who pays

**Founder decisions, 6 October 2026.** The decisions below stand. **The mechanism
section of the original draft was wrong and is corrected by D52**, after Session 4's
Task 2 audit and Session 1's own verification.

**What is actually true of the schema today:**

- **Commission** lives in **`fee_rates`**, read through
  `private.current_fee_bps('commission')`, which returns 0 with no row. Setting 2
  percent is a `fee_rates` row. `money_policy` has **no `commission_bps` column**.
- **`money_policy.guarantee_bps` is 0.** It was declared
  `check (guarantee_bps between 100 and 200)`; `20261006103626_b3_money_policy_versions.sql`
  replaced that with `money_policy_guarantee_bps_range` (0 to 200), which is the
  migration that let the Guarantee retire.
- **Zeroing the rate does not lift the `PAYSTACK_GUARANTEE_SUBACCOUNT` blocker.**
  Two gates refuse before the rate is ever consulted: `split-attempt.ts:74` returns
  `refused` when the reserve subaccount is unset, and the database requires
  `reserve_subaccount_code` non-null on a before-insert trigger. **The founder still
  needs that `ACCT_` code, or both gates have to change.**
- **VAT is not modelled anywhere.** `vat_bps` and `vat_registered` do not exist.
  They are new columns and new code, not a flag to flip.

---

## 1. The decisions

| | |
|---|---|
| **Vallo commission** | **2%** (`commission_bps = 200`) on every transaction, both rails |
| **Vallo Guarantee** | **Retired. `guarantee_bps = 0`.** Machinery kept, rate zero |
| **VAT** | **Not charged. `vat_bps = 0`, `vat_registered = false`** |
| **Referral reward** | **70 naira** per qualified referral |
| **Referral cap** | **1,500 qualified referrals per member per month** |
| **Withdrawal minimum** | **1,000 naira** |

### Why the Guarantee went

Escrow already protects the renter: the money is held until conditions are met.
Charging 1 to 2 percent more for the same promise, out of the lister's share, on
top of Payluk's 2 percent, meant **4 percent on a platform with no listers to
lose**. It also had the shape of insurance, which this repository already refuses
elsewhere as NAICOM-regulated, and nobody had decided what happens to money nobody
claims.

**The machinery stays built**: `guarantee_reserve_entries`, the claims flow, the
admin desk, `escalate_caution_to_guarantee`. At zero basis points no contribution
is taken. If the direct rail later shows real fraud, it is one row to switch on,
for that rail only.

**Two consequences that are work, not footnotes.** Every Guarantee sentence comes
out of `lib/money/copy.ts`, the Terms, the help centre and the emails, and the
renter-facing trust story is replaced with what is actually true: **your payment
is held until you confirm**. And `PAYSTACK_GUARANTEE_SUBACCOUNT` may stop being a
blocker entirely, since there is no reserve leg to route. **Session 2 verifies
that rather than assuming it**, because the split currently refuses a charge whose
reserve leg is missing.

### Why no VAT

Nigeria's VAT registration threshold is **25 million naira of turnover**, and
turnover means Vallo's own revenue, which is the 2 percent, **not the value of
the transactions it facilitates**. At 2 percent that is roughly 1.25 billion naira
of volume before the question arises. **Charging VAT while unregistered is an
offence**, so the rate is zero and the flag is false.

When it is switched on: VAT applies to **Vallo's fee only, never to the rent**,
it is borne by whoever pays the fee, and it is recorded as **its own ledger line**
because it is remitted to FIRS and was never Vallo's money.

---

## 2. What each rail costs, and who pays

**Escrow rail** (rent, shortlet, apartments, land, sale):

| | |
|---|---|
| Payluk | **2% of the escrow amount** (2.5% for escrows created in Payluk's own app) |
| Vallo | **2%** |
| **Total** | **4%**, borne by the lister |

Payluk's `whoPays` field takes `buyer`, `seller` or `both`. **It is `seller`**, set
in Payluk's merchant dashboard, and section 6 gives the reasoning.

> **Corrected on 6 October.** This passage used to say the founder had not yet chosen
> and that the rail could not open until he did, which **contradicted section 6 of this
> same document**, where the decision is recorded. Session 3 found the contradiction
> while building the fee screen. **The decision was made; this paragraph was stale.**
> There is one answer and it is the same on both rails: **the lister bears the fee, always.**

**Direct rail** (hotels, restaurants): Paystack's own fee, which **caps at 2,000
naira**, plus Vallo's 2 percent. **No provider takes a percentage here, so Vallo
keeps the whole 2 percent and the cost does not scale with the amount. The direct
rail is where the margin is.** The cap means the direct rail gets
proportionally cheaper as amounts rise, while the escrow rail does not cap at all.
**On a large transaction the escrow rail is substantially more expensive**, and
that difference will steer listers toward the rail with no protection unless the
pricing or the default routing accounts for it.

---

## 3. Withdrawal fees

**The founder's tiers, as given:**

| Amount withdrawn | Vallo fee |
|---|---|
| Under 100,000 | 50 |
| 200,000 to 500,000 | 200 |
| 500,000 to 2,000,000 | 300 |
| 2,000,000 and above | 2,500 |

**Three things need deciding before this ships.**

**1. There is a gap: 100,000 to 200,000 is not covered.** A member withdrawing
150,000 naira falls between two rules. **Session 1's call, overridable: the 200
naira band starts at 100,000**, so the table is continuous. A pricing table with a
hole in it is a support ticket and a refund.

**2. The 2,000,000 boundary is a cliff that teaches people to game it.** At
1,999,999 the fee is 300; at 2,000,001 it is 2,500, **more than eight times
higher**. Anyone withdrawing 2.5 million will send two withdrawals of 1.25 million
and pay 600 instead of 2,500. **Session 1's call: the top band is a percentage
with a cap rather than a flat jump**, so there is no boundary worth gaming.

**3. The fee is not a transfer fee, and Nigerians know what a transfer costs.**
The CBN's electronic transfer guide caps NIP fees at **50 naira** above 50,000
naira, and Paystack's own transfer pricing is 10, 25 and 50 naira by band. **A
member's own bank moves 2 million naira for 50 naira.** A 2,500 naira Vallo fee on
the same money is fifty times that, and on a platform whose promise is "without
the runaround" it will be read as extractive and screenshotted.

**The under-100,000 band at 50 naira is exactly right** and matches what the market
expects. The high bands are the ones to reconsider, and they are also the ones that
**will almost never fire at launch**: referral payouts run from 1,000 to 105,000
naira, so every withdrawal in the first months sits in the 50 naira band.

### The operational constraint that governs all of it

**Payluk does not publish its withdrawal fee and it is not fixed.** Its own
documentation: *"Payluk sets the `fee` on the returned intent; you do not send it.
The customer is debited `amount + fee` ... The fee depends on the amount and on
which provider Payluk currently settles payouts through, and it may include VAT.
It is fixed on the intent when the intent is created."*

So: **create the intent, read back the provider fee, add Vallo's band, and show
the member one total before they confirm.** Never compute a withdrawal cost from a
hardcoded table, and never quote a figure before the intent exists. Reconcile
against the fee read back, not against an assumption.

**Show the member the breakdown**, because a single unexplained deduction is how
trust is lost:

```
Amount            1,000,000
Processing fee          300
You'll receive      999,700
```

---

## 4. Referral economics, and the exposure the founder should see

**70 naira per qualified referral. 1,500 qualified referrals per member per
month.**

That is **105,000 naira per member per month** at the ceiling. Ten accounts
farming it successfully is **1,050,000 naira a month**.

**So the monthly cap is not the fraud control.** At 1,500 it is high enough that
qualification is the only thing standing between Vallo and a fraud bill.
Three things follow, and Session 1 recommends all three:

1. **Qualification must be expensive to fake**: phone verified **and** a real
   action by the referred person, not a signup. A SIM card costs less than 70
   naira of effort; a completed search journey with a saved space, a booking, or a
   published and approved listing does not.
2. **A platform-wide monthly budget cap**, enforced server-side, separate from the
   per-member cap. Referral spend is otherwise unbounded, and a single viral
   moment becomes a liability Vallo cannot fund.
3. **1,500 referrals a month is 50 a day.** That is not a member, it is a
   professional. Consider whether reaching that volume should move somebody into a
   reviewed ambassador tier rather than continuing to accrue automatically.

**The rewards balance is a debt, not custody.** It is Vallo owing a member money,
which is a different legal object from Vallo holding a member's money, and that is
why it is called a **Rewards Balance** and never a wallet. It accrues as a
liability from the moment a referral qualifies, it never expires, and the
threshold is stated before anybody starts earning.

---

## 5. The three pots, which must never mix

| Pot | Whose money | Where |
|---|---|---|
| **Customer funds** | The member's | At the licensed provider, in their account there |
| **Vallo revenue** | Vallo's | Commission, withdrawal fees, promotion |
| **Marketing float** | Vallo's | Funds referral payouts through Paystack transfers |

Separated **in the schema**, not merely in a report. Payluk cannot do a three-way
split, so on the escrow rail Vallo's commission is a separate recorded movement,
which makes this a ledger requirement rather than bookkeeping taste.

---

## 6. Who pays, and the agreement that records it

**`whoPays: "seller"`.** The lister bears the fee on both rails. The renter or guest
sees **exactly the price advertised**, with no line item and no footnote.

**Why seller, in one line each.** It is what Booking.com, Uber, Amazon and Etsy do,
and the buyer seeing one clean price is the dominant professional model. Vallo
already publishes **"VALLO CHARGES NO INSPECTION FEE"** and *"Viewing a property
through Vallo is free"*, so a charge appearing at a renter's checkout would
contradict a live promise. And in Nigeria the renter already pays roughly 20
percent in agency and legal fees on top of rent, so adding to that side would make
Vallo part of the problem it was built to solve.

**For the lister this is a reduction, not a new cost.**

> **Corrected on 6 October.** This passage used to read "a lister replacing a 10 percent
> agent with Vallo's 4 percent keeps 96 percent instead of 90", and Session 3 built that
> sentence into the acceptance screen verbatim, which was the right thing to do with a
> figure from this document. **The figure was wrong, and the fault is here.** Four percent
> is the escrow rail; the direct rail is 2 percent plus a capped Paystack fee, so the lister
> keeps about 98 percent there. A single flat percentage contradicts this document's own rail
> table forty lines below.
>
> **It cannot be fixed by picking the other number either, because the rail is not knowable
> when the lister accepts.** Acceptance happens before publishing; the rail is chosen per
> booking, later, by how the buyer pays. So the screen shows a **range anchored on the worst
> case**, with the second two percent named as escrow protection rather than a Vallo fee.
> (The session report that held the layout was retired on 17 October 2026; the screen is `lib/money/lister-fee.ts` and its component.)
>
> **And the comparison needs dating.** "Instead of 90" asserts what other people charge. Ten
> percent is a fair description of the typical Nigerian agency fee, so it is defensible, but
> on a screen that forms part of an agreement it must be framed as a typical market rate as
> at a date, never attributed to a named competitor. If an agent charges eight percent,
> Vallo's screen is false and Vallo put it in writing.

The honest sales sentence is about the money the lister keeps in naira, not about a
percentage comparison. On 1,800,000 naira of rent, a lister replacing a typical 10 percent
agency fee keeps **between 1,728,000 and 1,764,000** rather than 1,620,000. Lead with that
figure. **Competing on the percentage alone invites a race against someone willing to charge
nothing, which Vallo cannot win and should not enter:** the advantage is that the money is
protected, the tenancy is documented, and the person on the other side is verified.

### The agreement gate

A lister cannot publish until they have seen the exact figures and accepted them.

```
Rent you set                          1,800,000

Platform fee                     36,000 to 72,000
  Vallo, 2%                           36,000
  Escrow protection, 2%
  when a buyer pays into escrow       36,000

You receive                   1,728,000 to 1,764,000
```

**The worst case is the headline.** "You receive 1,728,000" is what the lister should
remember, and if a booking lands on the direct rail they receive more. **A pleasant surprise
is the only acceptable direction for a money figure to move.**

Rules, all enforced server-side:

1. **Figures, not a percentage alone.** The naira amount and the net figure, on the
   listing's own numbers.
2. **Acceptance is recorded** against the listing with the member, the timestamp,
   and **the rate version in force at that moment**.
3. **A rate change never applies retroactively to an accepted listing.** If the
   rate moves, the lister is asked again, and keeps the old rate until they accept
   the new one.
4. **The same figures reappear at payout.** A deduction a lister first understands
   when the money arrives is how a landlord is lost permanently.

---

## 7. Where the commission actually lands, and the job that is easy to forget

**Paystack rail: automatic.** `apps/web/src/lib/payments/paystack.ts` builds a flat
split with `bearer_subaccount` set to the lister, so the lister bears Paystack's
processing fee as well. The subaccounts array carries the lister's share and, when
non-zero, the Guarantee leg. **Vallo's commission is not a subaccount: it is the
remainder, and it settles to Vallo's own main account by itself.** Nothing to
collect. Note that at `guarantee_bps = 0` the reserve leg is skipped entirely
(`if (split.guaranteeMinor > 0)`), which is the evidence that the
`PAYSTACK_GUARANTEE_SUBACCOUNT` blocker should lift. **Session 2 verifies it.**

**Payluk rail: not automatic, and this needs a job.** Payluk's own documentation:
*"plus your own commission, if you set one in your merchant settings ... credited
to your merchant wallet as a `commission` transaction"*, and *"Commission is
charged once, as on a completion."*

So Vallo's 2 percent on escrow is **a setting in Payluk's merchant dashboard**, not
a value passed per transaction, and it **accrues inside Vallo's Payluk merchant
wallet** until somebody withdraws it. That difference is a real operational risk:
Paystack revenue arrives on its own, Payluk revenue piles up somewhere nobody is
watching.

**Required:** a scheduled sweep that reads the merchant balance
(`GET` merchant balance), withdraws to Vallo's bank, records the movement in the
ledger as **Vallo revenue** and never as customer funds, and an admin surface
showing the merchant balance, the last sweep and anything that failed. Paced
against the ten-requests-per-minute limit.

---

## 8. What this pricing is, measured against the market

| | Platform take |
|---|---|
| Uber | ~25% |
| Booking.com | 15 to 20% |
| Airbnb | ~17% (3% host, 14% guest) |
| **Nigerian estate agents** | **~20%** (10% agency, 10% legal), **paid by the renter** |
| **Vallo, escrow rail** | **4%**, paid by the lister |
| **Vallo, direct rail** | **2%** plus a capped Paystack fee, paid by the lister |

**Vallo is between four and six times cheaper than every comparable, and the renter
pays nothing.** There is no competitor in this market offering that, and it is a
sentence that fits on a billboard.

**Two things to keep in view as volume grows.** On the escrow rail Vallo pays
Payluk 2 percent and keeps 2 percent, so **half of the fee is infrastructure cost**,
which is worth renegotiating once there is volume to negotiate with. And **raising
a price later is far harder than setting it now**: the direct rail, where no
provider takes a percentage and Paystack's fee caps at 2,000 naira, is the better
margin and may be the better business.

**One rate that should not stay flat: sale and land.** Four percent of 80,000,000
naira is 3,200,000, which no seller will accept, while 2 percent to Vallo on that
same sale is the largest single transaction the platform will see.
`money_policy` holds rates in basis points, so a per-space-type rate with an
absolute cap above a threshold is one row. **Decide it before the first land
listing, not after.**
