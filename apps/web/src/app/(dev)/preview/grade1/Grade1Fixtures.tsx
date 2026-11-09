"use client";

import { useEffect, useState } from "react";
import { StepFrame } from "@/components/ui/StepFrame";
import { banner } from "@/lib/ui/toast";
import { KycFlow, type KycCopy } from "@/components/verification/KycFlow";
import type { Dictionary } from "@vallo/i18n/core";

const KINDS = ["Shortlet", "Property for rent", "Property for sale"] as const;

export function Grade1Step({ saving }: { saving: boolean }) {
  const [step, setStep] = useState(3);
  const [dir, setDir] = useState<"forward" | "back">("forward");
  const [pick, setPick] = useState<string>(KINDS[1]);
  return (
    <StepFrame
      step={step}
      total={12}
      eyebrow="The basics"
      title="What are you listing?"
      subtitle="Pick one. You can list more later."
      save={saving ? "saving" : "saved"}
      onBack={() => {
        setDir("back");
        setStep((n) => Math.max(1, n - 1));
      }}
      closeHref="/home"
      direction={dir}
      primary={{
        label: "Continue",
        onClick: () => {
          setDir("forward");
          setStep((n) => Math.min(12, n + 1));
        },
      }}
    >
      <div role="radiogroup" aria-label="What are you listing?" className="grid gap-sm">
        {KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            role="radio"
            aria-checked={pick === kind}
            onClick={() => setPick(kind)}
            className="nf-panel p-card text-start"
            style={pick === kind ? { borderColor: "var(--nf-brand-primary)" } : undefined}
          >
            {kind}
          </button>
        ))}
      </div>
    </StepFrame>
  );
}

const WORDS: Record<string, [string, "success" | "error" | "info" | "warning"]> = {
  success: ["Saved to your list", "success"],
  error: ["Message couldn't be sent. Check your connection and try again.", "error"],
  info: ["Saved on your device. Price and availability may have changed.", "info"],
  warning: ["Your session ends in 2 minutes", "warning"],
};

export function Grade1Banner({ tone }: { tone: string }) {
  useEffect(() => {
    const [message, kind] = WORDS[tone] ?? WORDS.success!;
    banner[kind](message, { durationMs: 600_000, ...(kind === "error" ? { retry: () => undefined } : {}) });
  }, [tone]);
  return null;
}

/* The real verification flow with a submit that sends nothing. `open` taps
   Start on mount so the first full-screen step can be screenshotted. */
export function Grade1Verify({ copy, flowCopy, open }: { copy: KycCopy; flowCopy: Dictionary["verifyFlow"]; open: boolean }) {
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => document.querySelector<HTMLButtonElement>('[data-testid="kyc-start"]')?.click(), 300);
    return () => window.clearTimeout(t);
  }, [open]);
  return (
    <KycFlow
      copy={copy}
      flowCopy={flowCopy}
      submit={async () => ({ ok: false, message: "This harness does not send anything." })}
    />
  );
}
