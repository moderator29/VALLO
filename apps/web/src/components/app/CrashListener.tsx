"use client";

import { useEffect } from "react";
import { installGlobalCrashHandlers } from "@/lib/observability/client";

/**
 * Mounts the crash log's window and promise listeners once, from the root
 * layout, so a crash outside a React error boundary (an event handler, a
 * timer, an unawaited promise) reaches /admin/crashes too. Renders nothing.
 */
export function CrashListener() {
  useEffect(() => {
    installGlobalCrashHandlers();
  }, []);
  return null;
}
