# The protected payment adapter (built switched off)

Server-only. Nothing here moves money today, and nothing can until all of
these are true:

1. The provider's official sandbox documentation is in hand. The contract in
   `docs/handoff/PAYMENTS_MIGRATION_AUDIT.md` section 10.2 lists each unknown.
2. Every `TODO(provider-docs)` in this folder is replaced by the documented
   fact, with the documentation section it came from.
3. `DOCUMENTED` in `client.ts` is set to true in the same change.
4. The founder turns on `payments_escrowpay_on`. The switch fails closed, and
   `PAYMENTS_KILL_ESCROWPAY=1` stops it again in an outage.

Until then:

- `escrowPayConfig` reads the environment and never invents a base URL.
- `escrowPayRequest` answers `not_configured` before any network call.
- `verifyEscrowPaySignature` answers false, so a webhook route refuses
  everything.
- `normaliseEscrowPayStatus` maps no provider word, so nothing becomes funded
  or released.

Run its tests with `npx vitest run src/lib/payments/providers/escrowpay`.
