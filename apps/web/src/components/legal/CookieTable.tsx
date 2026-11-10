import { DocTable } from "@/components/docs/DocTable";
import { CATEGORY_LABEL, KIND_LABEL, itemsIn, type StorageCategory } from "@/lib/consent/inventory";

/**
 * EVERY COOKIE AND PIECE OF DEVICE STORAGE OF ONE KIND, drawn from the one
 * inventory (`lib/consent/inventory.ts`). Nothing here is typed by hand, so the
 * Cookies page cannot drift from what the app stores (`inventory.test.ts`).
 */
export function CookieTable({ category }: { category: StorageCategory }) {
  const items = itemsIn(category);
  return (
    <DocTable
      caption={`${CATEGORY_LABEL[category]}: everything Vallo stores`}
      columns={[
        { key: "name", label: "Name" },
        { key: "type", label: "Type" },
        { key: "purpose", label: "What it is for" },
        { key: "lifetime", label: "How long it lasts" },
      ]}
      rows={items.map((item) => ({
        id: `${item.kind}-${item.id}`,
        cells: {
          name: <code>{item.name}</code>,
          type: `${KIND_LABEL[item.kind]}${item.setBy === "Supabase" ? ", set by our sign-in provider" : ""}`,
          purpose: item.purpose,
          lifetime: item.lifetime,
        },
      }))}
    />
  );
}
