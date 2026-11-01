# VALLO AI Assistant

Phase 1 (1 November 2026): the enforcement layer, the settings, the consent
flow and the four public documents. Phase 2 (private tools, interactive
cards, viewing and payment proposals) builds on it.

## Status you need to know

- **The database migration is NOT applied yet.** The Supabase connector asked
  for a confirmation and got no answer. The SQL is in
  `docs/PENDING_ai_assistant_enforcement.sql.txt`. Apply it (founder, or a
  session that can approve the connector prompt), save it as
  `supabase/migrations/<version>_ai_assistant_enforcement.sql`, run
  `node scripts/check-migrations.mjs --record <file>`, and move
  `supabase/tests/probes-pending/ai-assistant-enforcement.sql` to
  `supabase/tests/probes/`. Until then the settings page shows the assistant
  as OFF for everybody (every read fails closed) and cannot turn it on.
- **Counsel should review the four documents** in `lib/legal/ai-assistant.tsx`
  before they are relied on. They describe product behaviour; they are not a
  substitute for legal review.

## Shape

- Off by default. `ai_assistant_activate` needs both acceptances and the current
  versions (`2026-11-01`); the sensitive permissions (transactions, wallet
  balance, payment help) are never granted at activation.
- Every grant, revoke and audit write is a SECURITY DEFINER function reading
  `auth.uid()` itself; the tables are read-only to members under RLS.
- `lib/assistant/access.ts` is the server layer; tools declare `requires` and
  are hidden by `toolsFor` and checked again by `runTool` against the database.
- Granting a sensitive permission also needs an unlocked Vallo session
  (`passcodeMoneyRefusal`).
- Eight refused requests in ten minutes switch the assistant off for that
  member and raise a medium risk alert.
- Settings: `/settings/ai-assistant`, `/settings/ai-assistant/consent`.
  Public documents: `/ai/terms`, `/ai/privacy`, `/ai/permissions`, `/ai/security`.

## Not in Phase 1

Private tools (transactions, balance, bookings, viewings), interactive action
cards, `ai_action_proposals` functions and the payment confirmation flow,
personalised "Picked for You", learning from activity. The proposals table and
RLS exist; the functions that create and confirm proposals do not yet.
