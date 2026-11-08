import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { getDictionary } from "@vallo/i18n";
import { ClientCopyProvider } from "@/lib/i18n/client-copy";
import { clientCopyOf } from "@/lib/i18n/client-copy-of";
import { ToastHost } from "@/components/ui/ToastHost";

/**
 * The root a browser-mounted test renders into (`mount-in-browser.ts`),
 * inside the same provider the root layout draws, in English: the copy
 * provider and the toast host (so `banner.*` calls render in tests).
 * There is no framer-motion provider, because the root layout has
 * none (D49.1): the ported components drive motion values and `animate`
 * directly, and their reduced-motion answer is the platform's own gate
 * (`useMotionGate`), read inside each component.
 */
export function mount(node: ReactNode): void {
  const root = createRoot(document.getElementById("root")!);
  root.render(
    <ClientCopyProvider copy={clientCopyOf(getDictionary("en"))}>
      {node}
      <ToastHost />
    </ClientCopyProvider>,
  );
  requestAnimationFrame(() => {
    (window as unknown as { __mounted: boolean }).__mounted = true;
  });
}
