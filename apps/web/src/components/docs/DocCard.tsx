import Link from "next/link";
import { IconPlate, ICON_PLATE_GLYPH } from "@/components/ui/IconPlate";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import "./docs-kit.css";

/**
 * THE INDEX CARD. A tinted container holding a thin line icon, a bold title,
 * one plain sentence and a chevron. Every index in the written surface (the
 * legal documents, the help topics, the guides, the staff manual) uses this one
 * card, so a nervous reader can scan nine documents in four seconds and know
 * which one answers their question.
 *
 * Server-safe. The whole card is the link, so the target is the full row.
 */
export type DocCardProps = {
  href: string;
  title: string;
  /** One sentence, saying what is inside. */
  line: string;
  icon: UiIconName;
  /** A tighter card for dense indexes. */
  compact?: boolean;
  lang?: string;
};

export function DocCard({ href, title, line, icon, compact = false, lang }: DocCardProps) {
  return (
    <Link href={href} className="nf-dk-card" data-compact={compact || undefined} lang={lang}>
      <IconPlate size="md" tone="brand">
        <UiIcon name={icon} size={ICON_PLATE_GLYPH.md} />
      </IconPlate>
      <span className="nf-dk-card__text">
        <span className="nf-dk-card__title">{title}</span>
        <span className="nf-dk-card__line">{line}</span>
      </span>
      <UiIcon name="chevron-right" size={20} className="nf-dk-card__chev" />
    </Link>
  );
}

/** A grid of cards as a real list. */
export function DocCards({
  items,
  label,
  wide = false,
  compact = false,
}: {
  items: readonly DocCardProps[];
  label: string;
  wide?: boolean;
  compact?: boolean;
}) {
  return (
    <ul className="nf-dk-cards" aria-label={label} data-wide={wide || undefined}>
      {items.map((item) => (
        <li key={item.href}>
          <DocCard {...item} compact={compact || item.compact} />
        </li>
      ))}
    </ul>
  );
}
