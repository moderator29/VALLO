"use client";

import dynamic from "next/dynamic";

/**
 * The calculator in its own chunk (see `components/docs/lazy.tsx`). The
 * chapter page imports this section for the one chapter that asks for it, so
 * without the split every chapter carried the calculator and, through it,
 * the whole of `lib/money/copy.ts`. It still renders on the server.
 */
export const FeeCalculator = dynamic(() => import("./FeeCalculator").then((m) => m.FeeCalculator));
