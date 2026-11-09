"use client";

import { usePathname } from "next/navigation";
import { ToastHost } from "@/components/ui/ToastHost";
import { ConnectionLine } from "@/components/ui/ConnectionLine";
import { BackToTop } from "@/components/ui/BackToTop";
import { FormKeys } from "@/components/ui/FormKeys";
import { RefusalHost } from "@/components/ui/RefusalHost";
import { KeyboardShortcuts } from "@/components/ui/KeyboardShortcuts";

/**
 * The small things every screen shares, mounted once in the root layout:
 * the one toast, the connection line, back to top and the return key
 * that says what it will do, and the one that lets a refused field shake.
 * Each renders nothing
 * until it has something to say.
 */
export function DetailsHost() {
  /* A new page starts with back to top put away. */
  const pathname = usePathname();
  return (
    <>
      <ConnectionLine />
      <BackToTop key={pathname} />
      <ToastHost />
      <FormKeys />
      <RefusalHost />
      <KeyboardShortcuts />
    </>
  );
}
