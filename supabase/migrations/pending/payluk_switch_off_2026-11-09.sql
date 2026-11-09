-- Turns the old escrow provider's switch OFF (checked live 9 November 2026).
-- `payments_payluk_on` has been TRUE in the live database since 8 October
-- 2026, while the code, the migrations (seeded false) and the founder's
-- standing rule all say the protected rail is off until a signed agreement.
-- Whether members could actually reach it depends on a Payluk key in Vercel,
-- which the repository cannot see; zero arrangements have ever been opened.
-- The kill switch fails closed, so false means off everywhere the escrow rail
-- is offered (lib/payments/providers/kill-switch.ts). Members then see card
-- only, which is the launch position (PROTECTED_PAYMENTS_BUILD.md section 10).
-- Reversible: set enabled back to true. Touches no money row.
update public.feature_flags
   set enabled = false, updated_at = now()
 where key = 'payments_payluk_on' and enabled;
