# ADR 0003: A licensed provider holds the money; Vallo records it

**Status:** accepted, 7 October 2026.
**Amends:** ADR 0002 (Vallo never holds customer money). ADR 0002's principle
stands and is strengthened. Its blanket sentence "there is no wallet, no
balance, no escrow" is replaced by the decision below.

## Decision

Vallo never takes custody of customer money. That is permanent and it is the
reason this file exists rather than a loosening of it.

Escrow, a spendable balance, deposits and withdrawals are all part of the
product. **the retired provider holds the funds.** the retired provider is the licensed escrow provider.
Vallo creates the arrangement, watches it, records it, settles its own fee out
of it and shows every party where their money is. At no point does money rest
in an account Vallo controls on a customer's behalf.

Three consequences follow, and all three are binding.

### 1. Vallo's database mirrors provider state; it never is the state

Every figure Vallo stores about a customer's money is a recorded observation of
what the provider reported, carrying the provider's reference and the time it
was observed. The provider is the book of record. Vallo's copy exists so the
product can be fast, auditable and honest about staleness, not so it can be
authoritative. Where the two disagree, the provider wins and reconciliation
raises it.

A balance Vallo shows is therefore a provider balance Vallo is reporting. It is
never a figure Vallo computed and owes.

### 2. The custody naming guard stays, on purpose

`private.refuse_custody_objects`, the event trigger installed on 25 September
2026, refuses any table, view, function or materialised view in `public` or
`private` whose name matches `(^|_)(wallets?|escrows?|pots?)(_|$)`, or starts
with `held_payment`. It fires on `CREATE TABLE`, `CREATE TABLE AS`,
`CREATE VIEW`, `CREATE FUNCTION`, `CREATE MATERIALIZED VIEW`, `ALTER TABLE` and
`ALTER FUNCTION`.

It is not removed and it is not weakened. It is the only mechanism that stops
Vallo held custody from reappearing quietly, one convenient column at a time,
eighteen months from now when nobody on the team remembers why it mattered.

So Vallo's own objects are named for what Vallo actually does with them:

| What it is | A name the guard refuses | A name that says the truth |
| --- | --- | --- |
| The provider arrangement for one deal | `escrows` | `provider_arrangements` |
| What the provider reports a member can draw on | `wallets` | `member_funds_reported` |
| A movement the provider reported | `wallet_entries` | `funds_movements` |
| Money fenced for a purpose | `marketing_pot` | `marketing_float` (already live) |
| A release waiting on a condition | `escrow_holds` | `release_conditions` |

This is a naming rule, not a feature restriction. Every behaviour the founder
asked for is built. The words `wallet` and `escrow` remain free in the
interface, in copy, in component names and in TypeScript, because that is what
members and the provider call these things. The constraint is on database
object names only, and it exists so that the schema can never be read as
evidence that Vallo holds money.

### 3. The member-facing promise does not change

Vallo tells members, plainly, that Vallo does not hold their money and names
who does. The provider is never presented as Vallo, and Vallo is never
presented as the custodian. This is the one place where the provider is allowed
to be visible: a one line statement of who holds the funds and a link to what
that means. Everywhere else the provider stays invisible, because a member
should not have to learn a vendor's name to rent a flat.

## Why this amendment exists

ADR 0002 retired custody because holding client funds between two parties is
regulated by the Central Bank of Nigeria and the company's objects clause does
not cover it. That reasoning is untouched: Vallo still does not do the regulated
thing.

What changed is that the product needs the protection escrow gives a renter in
Lagos sending a deposit to someone they met online, and the retired provider supplies that
protection under its own licence. ADR 0002 solved the legal problem by deleting
the feature. ADR 0003 keeps the legal position and buys the feature from
somebody allowed to sell it.

Left as it was, ADR 0002 read as a standing instruction never to build the
product's central trust mechanism, and the event trigger would have refused the
migration on the name alone. That contradiction stalls work and it was stalling
work. This file resolves it.

## Consequences

- `docs/payments/VALLO_FINANCIAL_LAYER.md` and `docs/MONEY_ARCHITECTURE.md` are
  read with this file next to them.
- The three pot ledger (`ledger_customer_funds`, `ledger_vallo_revenue`,
  `ledger_marketing_float`) is unchanged and remains append only.
- `scripts/db-probes` gains probes asserting that the mirror carries a provider
  reference and an observation time on every row, and that no Vallo table claims
  an authoritative customer balance.
- The commission sweep and the the retired provider merchant client already on main are
  consistent with this decision and need no change.

## The numbering, settled 8 October 2026

Two files were written as ADR 0003 independently: this one, and Session 2's "Two rails,
and escrow held by a provider, never by Vallo" of 6 October. The founder ruled that this
file keeps the number and governs. The other was renumbered to
`0004-two-rails-direct-and-provider-held-escrow.md`, accepted on the same day, and is
subordinate to this one: where the two disagree, this file wins.

They answer different questions and neither replaces the other. This one settles whether
a provider may hold customer money, that Vallo's records mirror provider state rather
than being it, and how Vallo's database objects are named so the custody guard stays
meaningful. ADR 0004 settles which rail a given payment takes, which is already built in
`public.payment_rail_policy` (migration `20261006030027`) and which D68d and D83 both
build on.
