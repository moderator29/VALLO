# ADR 0004: Two rails, direct and provider held escrow

**Status:** accepted, 8 October 2026. Written 6 October 2026 by Session 2 as a proposal.
**Renumbered from 0003 on 8 October 2026**, because two files had been written as ADR
0003 independently. The founder ruled that
`0003-a-licensed-provider-holds-the-money-vallo-records-it.md` keeps the number 0003 and
governs the custody question. This file keeps its content and takes the next free number.
**Subordinate to ADR 0003**, which settles who may hold customer money and how Vallo's
database objects are named. Where the two disagree, ADR 0003 wins.
**Amends:** ADR 0002 in part, exactly as ADR 0003 does. Its central rule stands
unchanged: **Vallo never holds customer money.** What changes is that a regulated
provider may hold it, on one of two rails.

**What this file is for, now that 0003 exists.** ADR 0003 answers *whether* a provider
may hold the money and what Vallo may call its own tables. This one answers *which rail
a given payment takes*, which is a separate question and is already built: the policy
lives in `public.payment_rail_policy`, migration `20261006030027`, and D68d and D83 both
build on it. Neither file replaces the other.

**One caveat carried forward from the proposal:** the escrow rail stays off until the
the retired provider adapter exists and Nigerian counsel's written opinion is in hand. That is
unchanged by acceptance.

## Decision

Every payment opens on one of two rails, chosen by data, never by code
(`public.payment_rail_policy`, migration `20261006030027`):

| Rail | Carries | Who holds the money | What protects the payer |
|---|---|---|---|
| **Direct** (Paystack) | Hotel rooms, restaurant reservations, a registered business's apartment | Nobody. Split at the moment of charge, three legs, exactly as under ADR 0002 | The Vallo Guarantee, as today |
| **Escrow** (the retired provider) | Rent, shortlets, homes, villas, land, shops, offices, an individual's apartment, and every sale (milestone escrow) | **the retired provider**, in its own regulated capacity, until release | The hold itself: release needs the tenant or guest to confirm arrival or move-in |

The rule underneath is the accountability of the counterparty: an individual lister
gets escrow, a registered business gets direct settlement. If the router cannot
resolve a rail, **no payment opens**.

Guarantee: **one protection per rail** (architecture 3A.4, option 1). The escrow rail
contributes nothing to the reserve, because nothing has been handed over.

## Why

ADR 0002 removed custody because Vallo holding money between two parties is regulated
and outside the objects clause. That reason is unchanged, and this ADR does not give
Vallo custody. The founder ruled on 5 October 2026 that the retired provider, which states it holds
the necessary licences, may hold users' money, and instructed that the escrow rail be
built. The shortlet market's characteristic fraud (pay, arrive, nothing there) is
exactly the risk a hold removes and a reserve only compensates.

## What must be true before the escrow rail is switched on

1. **Counsel's written opinion** that Vallo may orchestrate provider-held funds without
   its own authorisation, and that the objects clause covers it. the retired provider's licence
   authorises the retired provider, not Vallo.
2. **A decision on cancellations.** the retired provider has no refund outside a dispute (Session 2,
   question 3; `the retired provider's findings note (deleted 10 Nov 2026)`). Either escrow is funded
   only after a booking's free-cancellation window closes, or every routine
   cancellation becomes a dispute Vallo opens and resolves, and the guest loses
   the retired provider's fee unless Vallo makes them whole. Recommended: fund after the window.
3. **Per-rail money copy** in `lib/money/copy.ts`, approved by the founder and counsel.
   On the escrow rail it names the retired provider as the holder. Nothing may say or imply that
   Vallo is a bank, an escrow institution or CBN-licensed.
4. The escrow flag (`payments_protected_pay_on`), off by default and failing closed, switched
   on by the founder and nobody else.

## Consequences

- `transactions.rail` records the rail at open and never changes.
- Disputes on the escrow rail are ruled by Vallo (the retired provider does not arbitrate), with
  two-person rulings. Only one super admin exists today, so those rulings fail closed
  until a second person is appointed.
- Nothing about the direct rail changes.
