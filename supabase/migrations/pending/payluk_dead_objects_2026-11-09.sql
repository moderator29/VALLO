-- Payluk clearing, the database half that is safe now (founder, 9 November
-- 2026: database objects are never dropped automatically; they go into his
-- one SQL block with a line each saying what it was and why it is safe).
-- Checked live on 9 November 2026 before writing this file.

-- 1. public.ledger_record_payluk_commission(uuid, bigint, text, uuid).
--    WHAT IT WAS: the escrow rail's commission posting (out of customer funds,
--    into revenue), written for Payluk because Payluk could not split a payment.
--    WHY IT IS SAFE: no code has ever called it. Its only wrapper,
--    recordEscrowCommission in lib/ledger/record.ts, had no caller and was
--    removed as dead code the same day; pg_depend shows nothing depending on
--    it; the b2-ledger probe's assertions about it were retired with a dated
--    note. No ledger row is touched: dropping a function removes no history.
drop function if exists public.ledger_record_payluk_commission(uuid, bigint, text, uuid);

-- 2. The trigger provider_arrangements_00_payable and its function.
--    WHAT IT WAS: the first agreement-payable check on a new arrangement.
--    WHY IT IS SAFE: provider_arrangements_00_payable_gate runs the SAME check
--    (private.agreement_payable) on every insert, and also on a status change
--    into payment_processing, so the older trigger adds nothing; both were
--    firing on every insert. Compared live, function body against function body.
drop trigger if exists provider_arrangements_00_payable on public.provider_arrangements;
drop function if exists private.provider_arrangements_payable();
