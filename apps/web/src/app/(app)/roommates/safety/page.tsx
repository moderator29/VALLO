import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";

import { SafetyView } from "./_parts/SafetyView";

const copy = getDictionary("en").roommates;

export const metadata: Metadata = { title: `${copy.safety.title}, ${copy.title}`, description: copy.ui.safety.subtitle };

/** The safety centre: the tips, what a badge means, how to report and block, where to ask. */
export default function RoommatesSafetyPage() {
  return <SafetyView t={copy} />;
}
