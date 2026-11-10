"use client";

import { useEffect } from "react";

/**
 * Tells the opening screen (`open-script.ts`) that the client has hydrated, so
 * it may lift once its minimum time has passed. Renders nothing.
 */
export function OpenReady() {
  useEffect(() => {
    (window as unknown as { __nfOpenReady?: boolean }).__nfOpenReady = true;
  }, []);
  return null;
}
