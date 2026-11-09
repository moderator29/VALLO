import { RemoteImage } from "@/components/ui/RemoteImage";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import type { CircleCategory } from "@/lib/features/circle/model";
import type { CircleAuthor } from "@/lib/features/circle/queries";
import { initial } from "@/lib/text/initial";

/**
 * Small shared marks for the Circle pages: a member's face (their real
 * photograph, or their initial on the brand ink, never an invented face) and
 * a community's glyph tile by category (communities have no cover yet).
 */
export function CircleFace({ author, size = "md" }: { author: CircleAuthor | null; size?: "sm" | "md" | "lg" }) {
  const px = size === "lg" ? 56 : size === "sm" ? 32 : 40;
  return (
    <span className="nf-cface" data-size={size} aria-hidden="true">
      {author?.avatar ? (
        <RemoteImage src={author.avatar} alt="" width={px * 2} height={px * 2} sizes={`${px}px`} loading="lazy" />
      ) : (
        <span className="nf-cface__monogram">{initial(author?.label ?? "M")}</span>
      )}
    </span>
  );
}

export const CATEGORY_GLYPH: Record<CircleCategory, UiIconName> = {
  neighbourhood: "location",
  renting: "key",
  buying: "house",
  landlords: "building-apartment",
  investing: "trending-up",
  short_lets: "building-hotel",
  design: "sliders",
  building: "land-plot",
  professionals: "briefcase",
  general: "circle-people",
  student_housing: "bed",
  roommates: "users",
};

export function CommunityGlyph({ category, size = "md" }: { category: CircleCategory; size?: "md" | "lg" }) {
  return (
    <span className="nf-cglyph" data-size={size} aria-hidden="true">
      <UiIcon name={CATEGORY_GLYPH[category] ?? "circle-people"} size={size === "lg" ? 28 : 22} />
    </span>
  );
}
