"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/actions/envelope";
import { banner } from "@/lib/ui/toast";

/**
 * Run one Deal Room action: show it working, say the outcome in the one top
 * banner (never under the form), refresh the room on success. A thrown error
 * (a dropped connection) is caught so the sheet keeps what was typed.
 */
export function useAct() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const run = useCallback(
    async function run<T>(fn: () => Promise<ActionResult<T>>, success: string, after?: (data: T) => void): Promise<boolean> {
      setPending(true);
      try {
        const result = await fn();
        if (result.ok) {
          banner.success(success);
          after?.(result.data);
          router.refresh();
          return true;
        }
        banner.error(result.error, { retry: () => void run(fn, success, after) });
        return false;
      } catch {
        banner.error("That did not go through. Check your connection and try again.", { retry: () => void run(fn, success, after) });
        return false;
      } finally {
        setPending(false);
      }
    },
    [router],
  );
  return { pending, run };
}

/** A key made once per mount of the thing that uses it. */
export function newKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
}
