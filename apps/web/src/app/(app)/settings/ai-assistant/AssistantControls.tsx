"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import {
  clearLearnedPreferences,
  deactivateAssistant,
  setAssistantPermission,
  setLearnedPreference,
} from "@/lib/assistant/settings-actions";
import { PERMISSIONS, type AiPermission } from "@/lib/assistant/permissions";
import { AI_GLYPH, PERMISSION_GLYPH } from "@/lib/assistant/glyphs";

/**
 * The assistant's controls once it is on: the master switch, one switch per
 * permission, the learned list. Every control calls a server action that the
 * database then enforces, and the screen re-reads the result, so what a
 * switch shows is what is saved.
 */

export function MasterSwitch({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onChange = (next: boolean) => {
    setError(null);
    if (next) {
      /* Never on in place: the first time goes through the agreement screen. */
      router.push("/settings/ai-assistant/consent");
      return;
    }
    setConfirming(true);
  };

  const turnOff = () =>
    start(async () => {
      const result = await deactivateAssistant();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setConfirming(false);
      router.refresh();
    });

  return (
    <div className="nf-ai-master" data-testid="ai-master">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={AI_GLYPH.assistant} alt="" width={72} height={72} className="nf-ai-master__glyph" />
      <Switch
        checked={enabled}
        onCheckedChange={onChange}
        disabled={pending}
        label="VALLO AI Assistant"
        description={
          enabled
            ? "On. It can only do what you allow below."
            : "Off. It can search public listings, and nothing about your account."
        }
        data-testid="ai-master-switch"
      />
      {confirming ? (
        <div className="nf-ai-confirm" role="alertdialog" aria-labelledby="ai-off-title" data-testid="ai-off-confirm">
          <h3 id="ai-off-title" className="nf-ai-set__title">
            Turn the assistant off?
          </h3>
          <ul className="nf-ai-confirm__list">
            <li>Every permission you gave is taken back at once.</li>
            <li>It stops reading your account, and anything it was preparing is cancelled.</li>
            <li>Your bookings, payments and history are not touched. A record of what it did is kept for your security.</li>
          </ul>
          <div className="nf-ai-set__foot">
            <Button variant="dangerQuiet" size="sm" onClick={turnOff} disabled={pending} data-testid="ai-off-yes">
              {pending ? "Turning off" : "Turn off"}
            </Button>
            <Button variant="quiet" size="sm" onClick={() => setConfirming(false)} disabled={pending}>
              Keep it on
            </Button>
          </div>
        </div>
      ) : null}
      {error ? (
        <p className="nf-rv-msg nf-rv-msg--error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function PermissionRows({ granted }: { granted: readonly AiPermission[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggle = (permission: AiPermission, next: boolean) => {
    setError(null);
    start(async () => {
      const result = await setAssistantPermission({ permission, granted: next });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div>
      <ul className="nf-ai-perms" aria-label="What the assistant may do">
        {PERMISSIONS.map((p) => {
          const on = p.floor ? granted.includes(p.key) : granted.includes(p.key);
          return (
            <li key={p.key} className="nf-ai-perm" data-testid={`ai-perm-${p.key}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={PERMISSION_GLYPH[p.key]} alt="" width={28} height={28} className="nf-ai-perm__glyph" />
              <div className="nf-ai-perm__text">
                <div className="nf-ai-perm__head">
                  <span className="nf-ai-set__title">{p.title}</span>
                  <span className={`nf-ai-badge nf-ai-badge--${p.kind}`}>{p.kind === "read" ? "Reads" : "Acts, with your approval"}</span>
                  {p.sensitive ? <span className="nf-ai-badge nf-ai-badge--sensitive">Sensitive</span> : null}
                </div>
                <p className="nf-ai-set__hint nf-ai-perm__detail">{p.detail}</p>
              </div>
              <Switch
                checked={on}
                onCheckedChange={(next) => toggle(p.key, next)}
                disabled={pending}
                aria-label={p.title}
                data-testid={`ai-perm-switch-${p.key}`}
              />
            </li>
          );
        })}
      </ul>
      <p className="nf-ai-set__hint nf-ai-note">
        Letting it read your transactions does not let it pay for anything. Payment help is its own permission, and every payment still needs your Confirm and a security check at that moment.
      </p>
      {error ? (
        <p className="nf-rv-msg nf-rv-msg--error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function LearnedList({ items }: { items: readonly { key: string; weight: number }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const result = await fn();
      if (!result.ok) {
        setError(result.error ?? "That did not go through.");
        return;
      }
      router.refresh();
    });

  if (items.length === 0) {
    return <p className="nf-ai-set__hint">Nothing yet. As you save and view places it will note what you like, and you can tell it directly in the chat.</p>;
  }
  return (
    <div>
      <ul className="nf-ai-learned" aria-label="What it has learned about you">
        {items.map((item) => (
          <li key={item.key} className="nf-ai-learned__row">
            <span className="nf-ai-learned__key">{item.key.replace(/_/g, " ")}</span>
            <span className="nf-ai-learned__acts">
              <Button size="sm" variant={item.weight > 0 ? "primary" : "quiet"} disabled={pending} onClick={() => run(() => setLearnedPreference({ key: item.key, stance: "like" }))}>
                Like
              </Button>
              <Button size="sm" variant={item.weight < 0 ? "primary" : "quiet"} disabled={pending} onClick={() => run(() => setLearnedPreference({ key: item.key, stance: "dislike" }))}>
                Dislike
              </Button>
              <Button size="sm" variant="quiet" disabled={pending} onClick={() => run(() => setLearnedPreference({ key: item.key, stance: "remove" }))}>
                Remove
              </Button>
            </span>
          </li>
        ))}
      </ul>
      <div className="nf-ai-set__foot">
        <Button size="sm" variant="dangerQuiet" disabled={pending} onClick={() => run(() => clearLearnedPreferences())} data-testid="ai-clear-prefs">
          Clear everything it learned
        </Button>
      </div>
      {error ? (
        <p className="nf-rv-msg nf-rv-msg--error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function LegalLinks() {
  return (
    <ul className="nf-ai-links">
      {/* eslint-disable @next/next/no-img-element */}
      <li><Link href="/ai/terms"><img src={AI_GLYPH.toggle} alt="" width={22} height={22} className="nf-ai-links__glyph" />AI Assistant Terms of Service</Link></li>
      <li><Link href="/ai/privacy"><img src={AI_GLYPH.privacy} alt="" width={22} height={22} className="nf-ai-links__glyph" />AI Privacy Policy</Link></li>
      <li><Link href="/ai/permissions"><img src={AI_GLYPH.permissions} alt="" width={22} height={22} className="nf-ai-links__glyph" />Permissions and Data Access</Link></li>
      <li><Link href="/ai/security"><img src={AI_GLYPH.security} alt="" width={22} height={22} className="nf-ai-links__glyph" />Security and User Protection</Link></li>
      {/* eslint-enable @next/next/no-img-element */}
    </ul>
  );
}
