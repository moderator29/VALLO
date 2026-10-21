# @vallo/design-tokens

`src/tokens.css`. That is the package.

Consumed by one line in `apps/web/src/app/globals.css`:

```css
@import "@vallo/design-tokens/tokens.css";
```

## There used to be a TypeScript mirror and it is gone

`src/index.ts` was 192 lines exporting six objects: `token`, `duration` and
`easing` as `var(--nf-*)` strings, and `palette`, `iconRamp` and
`iridescentRamp` as literal hex. It was the package's `main` and `types`.

**Nothing imported it.** Not one file in the repository, ever. The only thing
that reached this package was the CSS import above.

Its own docstring gave the reason it existed: "Needed because SVG
`<stop stop-color>` does not resolve `color-mix()` and some browsers
historically mishandled `var()` inside gradient stops." The first half is true
and the second is not, and the tree proves it: there are exactly two inline SVG
gradients in the product at the time, and the agent sparkline (since removed) wrote

```tsx
<stop offset="0%" stopColor="var(--nf-mode-agent)" stopOpacity="0.34" />
```

which resolves, follows the theme, and needed no mirror. The other,
`components/app/wallet/BalanceCard.tsx`, uses `currentColor`. Both solved the
problem the mirror was built for, without it, years after it was built.

The `var()`-string half was worse than unused. `token.contentPrimary` was the
string `"var(--nf-content-primary)"`: a second name for a token, offering
nothing over typing `var(--nf-content-primary)` at the call site, and one more
thing to keep in step. TypeScript cannot check a string against a CSS file, so
nothing ever did.

And the hex half had already drifted. Its own comments record it: eight inks and
five mists were left holding pre-rebrand purple-tinted greys, and three state
colours were a full step brighter than the values the product paints, so
"anything drawing an SVG from this file was quietly painting the old brand". A
hand-maintained copy of layer 1, with no consumer, that has already been wrong
once, is not an asset.

## If a JS mirror is ever needed again

The one case CSS genuinely cannot reach is `color-mix()` inside an SVG
`stop-color`, and a `<canvas>` that has to paint a brand colour. Neither exists
in the product today. When one does, add back only what that case needs, give it
the consumer in the same change, and have `scripts/check-css-tokens.mjs` guard
it: that script (part of `npm run lint`, run in CI) already fails on a `var(--nf-*)` in this package that
resolves to nothing, which is the check the old mirror never had.

## One loose end

`typescript` is still listed in `devDependencies` and there is now no
TypeScript in the package. Removing it needs an `npm install` to rewrite
`package-lock.json`, which is not a thing to do to a lock file while other
workstreams are writing to the tree. It is harmless where it is; take it out
with the next dependency change.

## Writing about a file in a comment

This belongs in a repository-level conventions document rather than here. It is
written down in the only doc-shaped file this workstream owns, because an
unwritten convention is the thing it exists to prevent. Move it when there is
somewhere better.

Two comments in this codebase vouched for components that have never existed:

    see components/site/Onboarding.tsx for the honest, localStorage-gated,
    reduced-motion-skipping trigger

    see app/agents/status/StatusIcon.tsx for the honest, one-shot trigger

Between them they vouched for fifteen rules of dead CSS, for months, and both
read as obviously live. A named source file is the strongest evidence a reader
gets that a rule is wired up, and nothing checked either one.

`apps/web/scripts/check-css-tokens.mjs` now stats every source path it finds in
a comment. It reports rather than fails, because whether a missing path is a
fault depends on the tense of the sentence around it and prose has no syntax for
tense. It found four kinds and only two are wrong:

| kind | example | verdict |
| --- | --- | --- |
| vouching | "see `components/site/Onboarding.tsx` for the trigger" | fault |
| stale | "`lib/agent/repository.ts` had already settled this" | fault |
| historical | "everything below arrived from `components/app/assistant/glyphs.tsx`" | correct |
| forward | "delete this the day `AgentShell` moves into `app/agent/layout.tsx`" | correct |

**So: write a full path with an extension only when you are asserting that the
file is there to be opened right now.** When you are recalling a file that has
gone, or predicting one that has not arrived, name the directory or drop the
extension:

    arrived from `components/app/assistant/`
    the day AgentShell moves into `app/agent/layout`

It says the same thing, a reader cannot mistake it for a live reference either,
and it is what lets the check become fatal. Every path in the design system's
own files already follows it; at the time of writing three references elsewhere
in the tree do not, and the check names them on every run.
