"use client";

import { useEffect } from "react";
import { banner, type ToastTone } from "@/lib/ui/toast";

/**
 * AN OUTCOME THAT ARRIVES WITH THE PAGE, SAID BY THE ONE BANNER (Grade 1).
 *
 * A server form action that redirects back with its outcome in the address
 * (`?claim=taken`, `?bulk=3-1-0`) used to print it as a status line on the
 * page. The server page names the sentence and its tone; this says it once,
 * at the top, the way every other outcome on the platform is said.
 * Renders nothing.
 */
export function BannerOnArrival({ message, tone = "success" }: { message: string | null; tone?: ToastTone }) {
  useEffect(() => {
    if (message) banner(message, { tone });
  }, [message, tone]);
  return null;
}
