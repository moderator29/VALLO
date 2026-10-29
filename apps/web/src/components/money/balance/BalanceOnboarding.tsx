"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { IconPlate, ICON_PLATE_GLYPH } from "@/components/ui/IconPlate";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { openBalanceAccount } from "@/lib/money/member-wallet-actions";
import { GAP_LABEL, HELD_BY, HELD_BY_HREF, HELD_BY_LINK, ONBOARDING_COPY, OPEN_ACTION, PHONE_TAKEN_COPY } from "@/lib/money/balance-copy";
import type { OnboardingState, OpenFailure, ProfileGap } from "@/lib/money/funds";
import { StepPath, type PathState } from "../StepPath";
import { reach } from "./reach";

/**
 * FINANCIAL ONBOARDING (founder section 9): "Do not make financial
 * onboarding feel like an ugly fintech form. It should feel like Vallo."
 *
 * So there is no form here at all, and the shape is the path (PREMIUM-
 * STANDARD reference 2, named there for financial onboarding): three steps,
 * each a 3D tile, two lines and a round status, joined by a line that fills
 * as they complete. Anything missing is a row inside the first step that goes
 * to the profile, where those details already live; opening is one button
 * inside the second. Each of the seven states has its own words.
 */
const WHO_DOES_WHAT: { icon: "shield-lock" | "user-check" | "eye-off"; title: string; sub: string }[] = [
  { icon: "shield-lock", title: "Our licensed partner holds the money", sub: "In an account in your name. Vallo never holds it." },
  { icon: "user-check", title: "Vallo keeps the record", sub: "Every movement, with where it is and when the partner confirmed it." },
  { icon: "eye-off", title: "Only what is needed is shared", sub: "Your name, email and phone. Nothing else, and no card or bank details." },
];

/** Where each state stands on the three steps: your details, opening, adding money. */
function pathFor(state: OnboardingState, missing: number): [PathState, PathState, PathState] {
  if (missing > 0) return ["current", "upcoming", "upcoming"];
  switch (state) {
    case "ACTIVE":
      return ["done", "done", "current"];
    case "PENDING":
      return ["done", "waiting", "upcoming"];
    case "FAILED":
    case "RESTRICTED":
    case "SUSPENDED":
      return ["done", "problem", "upcoming"];
    case "VERIFICATION_REQUIRED":
    case "NOT_STARTED":
    default:
      return ["done", "current", "upcoming"];
  }
}

export function BalanceOnboarding({
  state,
  gaps,
  failure = null,
}: {
  state: OnboardingState;
  gaps: ProfileGap[];
  failure?: OpenFailure | null;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(state);
  const [missing, setMissing] = useState(gaps);
  const [why, setWhy] = useState<OpenFailure | null>(failure);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const phoneTaken = current === "FAILED" && why === "phone_taken";
  const copy = phoneTaken ? PHONE_TAKEN_COPY : ONBOARDING_COPY[current];
  const canOpen = missing.length === 0 && (current === "NOT_STARTED" || current === "FAILED" || current === "PENDING" || current === "VERIFICATION_REQUIRED");
  const [details, opening, adding] = pathFor(current, missing.length);

  const open = async () => {
    setBusy(true);
    setError(null);
    const r = await reach(() => openBalanceAccount());
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setCurrent(r.data.state);
    setMissing(r.data.gaps);
    setWhy(r.data.failure ?? null);
    if (r.data.state === "ACTIVE") router.refresh();
  };

  /* THE WALLET OPENS BY ITSELF (27 October 2026, founder: no extra button).
     Once the details are in, the first visit tries to open it, and a request
     the partner has not answered is checked once more after a short wait.
     Further tries stay with the button: the opening is rate limited and a
     refusal is a real answer. `open` looks the customer up before it creates
     one, so a second tab or the phone-confirm step racing it is harmless. */
  const autoOpened = useRef(false);
  useEffect(() => {
    if (autoOpened.current) return;
    autoOpened.current = true;
    if (canOpen && (current === "NOT_STARTED" || current === "VERIFICATION_REQUIRED" || current === "PENDING")) void open();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
  }, []);
  const rechecked = useRef(false);
  useEffect(() => {
    if (current !== "PENDING" || busy || rechecked.current) return;
    const timer = window.setTimeout(() => {
      rechecked.current = true;
      void open();
    }, 15_000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one re-check per arrival
  }, [current, busy]);

  return (
    <div className="nf-onboard mt-inline space-y-block" data-testid="balance-onboarding" data-state={current}>
      <div className="nf-mhead">
        <span className="nf-mhead__art">
          <IconPlate size="lg" tone="brand">
            <UiIcon name="wallet" size={ICON_PLATE_GLYPH.lg} />
          </IconPlate>
        </span>
        <h2 className="nf-mhead__title">{busy ? "Setting up your balance" : copy.title}</h2>
        <p className="nf-mhead__body" role={busy ? "status" : undefined}>
          {busy ? "This takes a few seconds. You do not need to do anything." : copy.body}
        </p>
      </div>

      <StepPath
        label="Setting up Wallet"
        testId="balance-onboarding-path"
        steps={[
          {
            key: "details",
            title: "Your details",
            sub: missing.length > 0 ? "Add these to your profile first." : "Your name, email and a Nigerian mobile are on your profile.",
            state: details,
            children:
              missing.length > 0 ? (
                <ListGroup label="Add to your profile">
                  {missing.map((g) => (
                    <ListRow
                      key={g}
                      leading={
                        <IconPlate size="sm" tone="warning">
                          <UiIcon name="pencil" size={ICON_PLATE_GLYPH.sm} />
                        </IconPlate>
                      }
                      title={GAP_LABEL[g]}
                      href={g === "phone" ? "/settings/phone?next=%2Fwallet" : "/settings/account"}
                      chevron
                    />
                  ))}
                </ListGroup>
              ) : undefined,
          },
          {
            key: "open",
            title: "Open your account with our partner",
            sub:
              current === "PENDING"
                ? "Asked. Waiting for their answer; this updates on its own."
                : current === "RESTRICTED" || current === "SUSPENDED"
                  ? "On hold with our partner. Support can find out why."
                  : "Our licensed payments partner opens it in your name. Nothing is charged.",
            state: opening,
            children: phoneTaken ? (
              <div className="space-y-row">
                <ButtonLink href="/settings/phone?next=%2Fwallet" variant="primary" size="lg" full data-testid="balance-change-phone">
                  {PHONE_TAKEN_COPY.action}
                </ButtonLink>
                <Button variant="secondary" size="lg" full loading={busy} onClick={open} data-testid="balance-open">
                  Try again
                </Button>
              </div>
            ) : canOpen ? (
              <Button variant="primary" size="lg" full loading={busy} onClick={open} data-testid="balance-open">
                {current === "FAILED" ? "Try again" : current === "PENDING" ? "Check again" : OPEN_ACTION}
              </Button>
            ) : current === "RESTRICTED" || current === "SUSPENDED" ? (
              <ButtonLink href="/support" variant="secondary" size="lg" full>
                Contact support
              </ButtonLink>
            ) : undefined,
          },
          {
            key: "add",
            title: "Add money",
            sub: "From your own bank or card, once your account is open.",
            state: adding,
          },
        ]}
      />

      {error ? (
        <p role="alert" className="nf-body-sm text-[var(--nf-state-error)]">
          {error}
        </p>
      ) : null}

      <ListGroup label="Who does what">
        {WHO_DOES_WHAT.map((row) => (
          <ListRow
            key={row.title}
            leading={
              <IconPlate size="sm">
                <UiIcon name={row.icon} size={ICON_PLATE_GLYPH.sm} />
              </IconPlate>
            }
            title={row.title}
            sub={row.sub}
          />
        ))}
      </ListGroup>

      <p className="nf-caption text-[var(--nf-content-muted)]">
        {HELD_BY}{" "}
        <Link href={HELD_BY_HREF} className="underline">
          {HELD_BY_LINK}
        </Link>
      </p>
    </div>
  );
}
