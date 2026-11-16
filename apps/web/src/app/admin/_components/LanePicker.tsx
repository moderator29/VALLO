"use client";

import { useRouter } from "next/navigation";
import { UiIcon } from "@/design-system/icons/UiIcon";

export type LaneOption = { key: string; label: string; href: string; on: boolean; count?: number };

/**
 * The queue's lanes (Everything, Late, Mine, Nobody has it) as ONE chip on a
 * phone, where they were a second tab strip under the queue tabs.
 *
 * A native select, because the phone's own picker is the calmest control a
 * small screen has, and it never draws an overlay of ours. Choosing a lane
 * goes to that lane's address, the same link the desktop's segmented row
 * follows, so a narrowed queue is still a URL. Without scripts the select sits
 * in a GET form with a Go button, and the queue reads `lane` from the address
 * the same way.
 */
export function LanePicker({
  label,
  options,
  action,
  keep,
  go = "Go",
}: {
  label: string;
  options: LaneOption[];
  /** The path the no-script form posts to, and the fields it keeps. */
  action: string;
  keep: [string, string][];
  go?: string;
}) {
  const router = useRouter();
  const current = options.find((option) => option.on) ?? options[0];
  /* "Everything" is the queue with no lane at all, so its value is empty. */
  const valueOf = (key: string) => (key === "all" ? "" : key);
  return (
    <form method="get" action={action} className="nf-admin-lanepick">
      {keep
        .filter(([name]) => name !== "lane")
        .map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
      <label className="nf-admin-lanepick__chip">
        <span className="nf-admin-lanepick__label">{label}</span>
        <select
          name="lane"
          value={valueOf(current?.key ?? "all")}
          onChange={(event) => {
            const next = options.find((option) => valueOf(option.key) === event.target.value);
            if (next) router.push(next.href);
          }}
        >
          {options.map((option) => (
            <option key={option.key} value={valueOf(option.key)}>
              {typeof option.count === "number" ? `${option.label} (${option.count})` : option.label}
            </option>
          ))}
        </select>
        <UiIcon name="chevron-down" size={16} className="nf-admin-lanepick__chev" />
      </label>
      <noscript>
        <button type="submit" className="nf-btn nf-btn--ghost nf-btn--sm">
          {go}
        </button>
      </noscript>
    </form>
  );
}
