import Link from "next/link";
import type { ReactNode } from "react";
import { UiIcon } from "@/design-system/icons/UiIcon";
import "./docs-kit.css";

/** The inline pointer to a sibling document: a real link with an arrow that nudges on hover. */
export function DocCrossLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="nf-dk-cross">
      {children}
      <UiIcon name="arrow-right" size={16} />
    </Link>
  );
}
