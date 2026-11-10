import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";

import { PageFrame } from "@/components/app/PageFrame";
import { ROOMMATES_ROUTES } from "@/lib/features/roommates/model";

import { Checklist } from "./Checklist";

const copy = getDictionary("en").roommates;
export const metadata: Metadata = { title: `${copy.tools.checklistPage.title}, ${copy.title}` };

/** The move-in checklist: its words from the roommates scope, its ticks on this device. */
export default function ChecklistPage() {
  return (
    <PageFrame title={copy.tools.checklistPage.title} subtitle={copy.tools.checklistPage.intro} fallback={ROOMMATES_ROUTES.home} width="narrow">
      <Checklist />
    </PageFrame>
  );
}
