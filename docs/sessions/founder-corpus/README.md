# The founder's corpus

Two notes the founder wrote, in his own words, kept because the money rules in
`HANDOFF.md` section 2 and ADR 0002 and 0003 rest on them. They are his
reasoning, not specifications: where they and the code differ, the code and
`docs/MONEY_ARCHITECTURE.md` win.

| File | What it carries |
| --- | --- |
| `12-never-holds-money.md` | His research on why a marketplace should never hold customer money, and the proven pattern he chose. The origin of ADR 0002 and ADR 0003. |
| `13-provider-must-not-leak.md` | The rule that no provider name, no provider vocabulary and no provider failure mode may surface in the Vallo experience. Enforced by `lib/money/copy.ts` and the claims test. |

The rest of the corpus (the master prompts, the addendums, the old payment provider prompt,
the referral and motion briefs, the fee note) was deleted on 17 October 2026.
Everything in it that is still in force is built, and is restated in
`HANDOFF.md`, `docs/DECISIONS_2026-10-13.md` and `docs/RULINGS.md`.

The only edit ever made to these two files: every em dash became a hyphen,
because `apps/web/scripts/check-no-em-dash.mjs` fails the build on one.
