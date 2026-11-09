import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary } from "@vallo/i18n";

import { readInstitutionPage } from "@/lib/features/roommates/queries";
import { requestNow } from "@/lib/format/when";

import { CampusView } from "../_parts/CampusViews";

const copy = getDictionary("en").roommates;

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await readInstitutionPage((await params).slug);
  return { title: page.institution ? `${page.institution.name}, ${copy.title}` : copy.title };
}

/** One school: the read, then the screen. A school that is not listed is not found. */
export default async function CampusPage({ params }: Props) {
  const page = await readInstitutionPage((await params).slug);
  if (page.state === "not-found") notFound();
  return <CampusView page={page} t={copy} now={requestNow()} />;
}
