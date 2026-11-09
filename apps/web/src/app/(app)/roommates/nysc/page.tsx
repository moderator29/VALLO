import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";

import { NyscView } from "./_parts/NyscView";

const copy = getDictionary("en").roommates;

export const metadata: Metadata = { title: `${copy.nysc.title}, ${copy.title}`, description: copy.nysc.intro };

/** Corps members: choose the state of posting, see who is heading there; tips; the Circle community. */
export default function NyscPage() {
  return <NyscView t={copy} />;
}
