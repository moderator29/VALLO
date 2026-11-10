# DOCS PROOFREAD LOG

November 2026. HONEST SCOPE: this pass was mostly mechanical, not a human
line-by-line read of about 7,200 lines. A fuller read is still owed.

## Read or scanned

`app/(site)/docs/chapters.tsx`, `chapters-guide.tsx`, `chapters-more.tsx`,
`chapters-people.tsx`, `page.tsx`, `lib/support/help-articles.ts`, and the staff
manual chapters in `app/admin/manual/_chapters/` (all eleven files). Spot-read
in full: the refunds and cancellations chapter, the money chapter, the deletion
help article, the access and queues manual chapters around Guarantee claims.

## Mechanical checks and results

| Check | Result |
|---|---|
| Repeated words | none in prose (two hits were class names) |
| Words that appear once (423), eyeballed for misspellings | none found |
| US spellings (color, organize, canceled, behavior, license, traveler, etc.) | none |
| Product names: Vallo Stays, Property, Circle, Around, Roommates | consistent in the docs files; "Vallo Stays" appears in a few site pages (standards, careers) as the product name, matching docs |
| Stale facts: Payluk, wallet, escrow, Guarantee, rentme | none stale. Guarantee is described as retired on 9 November 2026; escrow as not offered; "no wallet" stated |
| Numbers vs code | Cancellation presets (Flexible 24 h; Moderate 5 days then half; Firm 30 days, 7 days half; Strict 7 days half) match `supabase/migrations/20261013062641_four_preset_cancellation_policies.sql`. 72 hours matches `FULL_REFUND_HOURS`. Deletion window comes from `GRACE_WINDOW_DAYS` |
| Dead links | not re-run; `docs-links.dom.test.tsx` covers them and is in the gate |

## Fixes made

Spelling 0, grammar 0, punctuation 0, factual corrections 0 in the docs
chapters. The only factual corrections of this brief are in the legal text
(see LEGAL_PAGES_CHANGES.md). Minor style left alone: "toward" appears where
British English would say "towards"; not changed to avoid churn.

## Could not verify

- Statements about features that are off or retired beyond the greps above.
- Any prose that is assembled from dictionary files in `packages/i18n`
  (not read in this pass).
- Staff manual statements about desk roles and scopes against the live
  database (needs the applied migrations, not read).
- Visual rendering of tables on a 360px phone.
