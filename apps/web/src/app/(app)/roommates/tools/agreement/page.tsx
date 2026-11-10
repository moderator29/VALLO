import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";

import { PageFrame } from "@/components/app/PageFrame";
import { ROOMMATES_ROUTES } from "@/lib/features/roommates/model";

import { AgreementBuilder } from "./AgreementBuilder";

const copy = getDictionary("en").roommates;
export const metadata: Metadata = { title: `${copy.tools.agreementPage.title}, ${copy.title}` };

/** The house agreement builder: rules chosen on this device, a plain-text note to copy. Nothing is stored on our side. */
export default function AgreementPage() {
  return (
    <PageFrame title={copy.tools.agreementPage.title} subtitle={copy.tools.agreementPage.intro} fallback={ROOMMATES_ROUTES.home} width="narrow">
      <AgreementBuilder />
    </PageFrame>
  );
}
