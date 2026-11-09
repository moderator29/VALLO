import "@/app/css/share.css";
import { ShareComposer, type ShareBackground } from "@/components/share/ShareComposer";

/**
 * /preview/features/share: the share composer with fictional subjects, for
 * visual review. Dev only. Every person here is invented.
 */
export const dynamic = "force-dynamic";

const PHOTO_BG: ShareBackground[] = [
  { id: "glow", label: "Brand glow", kind: "aurora", variant: "glow" },
  { id: "brand", label: "Brand", kind: "aurora", variant: "brand" },
  { id: "ink", label: "Night", kind: "aurora", variant: "ink" },
  { id: "room", label: "From the room", kind: "image", src: "/brand/features/backdrop.webp" },
];

export default async function PreviewShare({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const kind = (await searchParams).kind ?? "profile";
  const subject =
    kind === "listing"
      ? {
          avatar: "/brand/features/backdrop.webp",
          handle: "Yaba, Lagos",
          headline: "Ensuite room in a 3 bedroom flat",
          stats: [
            { label: "a year", value: "N1.2m" },
            { label: "your share", value: "N100k/mo" },
            { label: "rooms free", value: "1" },
          ],
          url: "/roommates/r/demo",
        }
      : {
          handle: "@adaeze",
          headline: "Adaeze N.",
          stats: [
            { label: "looking in", value: "Akoka" },
            { label: "budget", value: "N900k" },
            { label: "match", value: "92%" },
          ],
          url: "/u/adaeze",
        };
  return (
    <div className="px-md py-lg" data-testid={`preview-share-${kind}`}>
      <ShareComposer subject={subject} backgrounds={PHOTO_BG} />
    </div>
  );
}
