import { UnderlineTabs } from "@/components/ui/UnderlineTabs";

const ITEMS = [
  { key: "desk", label: "My desk", href: "/admin/my-desk" },
  { key: "tasks", label: "Tasks", href: "/admin/my-desk/tasks" },
  { key: "announcements", label: "Announcements", href: "/admin/my-desk/announcements" },
] as const;

/** The three pages of My Desk, as tabs. Each is its own route. */
export function DeskTabs({ active }: { active: (typeof ITEMS)[number]["key"] }) {
  return <UnderlineTabs label="My desk" active={active} items={ITEMS.map((i) => ({ ...i }))} />;
}
