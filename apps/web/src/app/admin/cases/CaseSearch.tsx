"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Search by case number, the reported thing's name, or a member or item id. */
export function CaseSearch({ initial, base }: { initial: string; base: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  return (
    <form
      role="search"
      className="flex items-center gap-sm"
      onSubmit={(e) => {
        e.preventDefault();
        const url = new URL(base, "http://x");
        if (q.trim()) url.searchParams.set("q", q.trim());
        else url.searchParams.delete("q");
        router.push(`${url.pathname}${url.search}`);
      }}
    >
      <label htmlFor="case-search" className="sr-only">
        Search cases
      </label>
      <input
        id="case-search"
        type="search"
        inputMode="search"
        enterKeyHint="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Case number, name or id"
        className="nf-field w-full max-w-md"
      />
    </form>
  );
}
