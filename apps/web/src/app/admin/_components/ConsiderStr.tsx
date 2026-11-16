import Link from "next/link";
import { getDictionary } from "@vallo/i18n";
import { considerStrHref, type StrSource } from "@/lib/admin/str";

/**
 * SCUML item 6: "Consider an STR", from anywhere on the console. It opens the
 * STR lane with the source filled in; nothing is recorded until staff write
 * the grounds and open the case. Staff only, and nothing about it reaches the
 * person.
 */
export function ConsiderStr({ from, id, subject }: { from: StrSource; id: string; subject?: string | null }) {
  const copy = getDictionary("en").complianceStr;
  return (
    <Link
      href={considerStrHref(from, id, subject)}
      className="nf-btn nf-btn--glass nf-btn--sm nf-admin-str inline-flex"
      data-testid="consider-str"
    >
      {copy.consider}
    </Link>
  );
}
