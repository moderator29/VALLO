import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";

import { listInstitutions } from "@/lib/features/roommates/queries";

import { CampusDirectoryView } from "./_parts/CampusViews";

const copy = getDictionary("en").roommates;

export const metadata: Metadata = { title: `${copy.campus.title}, ${copy.title}`, description: copy.ui.campus.subtitle };
export const dynamic = "force-dynamic";

/** The schools directory, searched by `?q=`. */
export default async function CampusDirectoryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = (await searchParams).q;
  const q = typeof raw === "string" ? raw.trim().slice(0, 60) : "";
  const list = await listInstitutions({ q, limit: 1500 });
  return <CampusDirectoryView live={list.live} items={list.items} q={q} t={copy} />;
}
