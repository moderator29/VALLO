"use client";
import "@/app/css/auth.css";

import { usePathname } from "next/navigation";
import { focalForPath } from "@/components/auth/focal-art";
import { FocalArtImage } from "@/components/auth/FocalArtImage";
import { MarkDraw } from "@/components/motion/MarkDraw";

/**
 * THE OBJECT ACROSS THE CURVE on every door (the founder's 3D glass door,
 * 30 September). The layout draws the block once, so the path decides which
 * object sits in the ring (`focal-art.ts`, with its own test). Decorative:
 * the ring is `aria-hidden` in `AuthCurveBlock`, and the title under it
 * names the screen.
 */
export function AuthFocal() {
  const art = focalForPath(usePathname() ?? "");
  if (art.kind === "object") return <FocalArtImage art={art} />;
  /* The mark draws itself once (founder ruling (a)): the ring, then the
     towers, from the exact brand paths; still under Calm, Off and reduced
     motion. */
  return <MarkDraw className="nf-slate-focal__mark" />;
}
