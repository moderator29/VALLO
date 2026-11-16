"use client";

import dynamic from "next/dynamic";

/**
 * THE DOCS' INTERACTIVE PIECES, EACH IN ITS OWN CHUNK.
 *
 * Every chapter is one route (`app/(site)/docs/[slug]`), and that page imports
 * every chapter module so it can draw any of them. A client component a
 * chapter imports directly is therefore in the script of EVERY chapter, drawn
 * or not: /docs/quick-start, which draws none of these, carried the offers
 * guide's step player, its account-aware buttons (and with them the wallet's
 * balance words) and both fee calculators (with the whole of
 * `lib/money/copy.ts`, a naira field and the table renderer). Measured on a
 * production build, 16 November 2026: four docs chunks, 34 KB on the wire,
 * and the weight gate read the page 38 KB over its budget.
 *
 * Wrapped here, each loads only on a page that draws it. They still render on
 * the server (`next/dynamic` keeps SSR), so the HTML a reader gets, and what
 * the controls do once they are live, is unchanged.
 */
export const DocButtons = dynamic(() => import("./DocButton").then((m) => m.DocButtons));
export const StepGuide = dynamic(() => import("./StepGuide").then((m) => m.StepGuide));
export const FeeCalculator = dynamic(() => import("./FeeCalculator").then((m) => m.FeeCalculator));
