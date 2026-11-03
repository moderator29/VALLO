"use client";

import { AI_GLYPH } from "@/lib/assistant/glyphs";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { activateAssistant } from "@/lib/assistant/settings-actions";
import { AI_PRIVACY_VERSION, AI_TERMS_VERSION } from "@/lib/assistant/permissions";

/**
 * The agreement screen. Activation stays disabled until the Terms, the
 * Privacy Policy and the one agreement tick are all ticked, and the database
 * checks the same three things again; this is only the polite front.
 */
export function ConsentForm() {
  const router = useRouter();
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [agree, setAgree] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const ready = terms && privacy && agree;

  const activate = () => {
    if (!ready) return;
    setError(null);
    start(async () => {
      const result = await activateAssistant({
        acceptTerms: terms,
        acceptPrivacy: privacy,
        agree,
        termsVersion: AI_TERMS_VERSION,
        privacyVersion: AI_PRIVACY_VERSION,
        permissions: ["discovery"],
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/settings/ai-assistant");
      router.refresh();
    });
  };

  return (
    <form
      className="nf-ai-consent"
      onSubmit={(e) => {
        e.preventDefault();
        activate();
      }}
      data-testid="ai-consent-form"
    >
      <section className="nf-panel nf-panel--card p-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={AI_GLYPH.assistant} alt="" width={72} height={72} className="nf-ai-master__glyph" />
        <h2 className="nf-ai-set__title">What you are turning on</h2>
        <p className="nf-ai-set__hint nf-ai-consent__p">
          VALLO AI becomes your personal assistant: it finds and compares places, explains them, and can prepare a viewing or a payment for you to approve. It starts with public listings only. Anything about your account, bookings or money is a separate permission you choose afterwards, one at a time, and you can take any of them back whenever you like.
        </p>
        <ul className="nf-ai-consent__list">
          <li>It never pays, books or changes anything without your own Confirm.</li>
          <li>It never sees your password, passcode, sign-in codes or card details.</li>
          <li>It can be wrong. It is not financial or legal advice.</li>
          <li>Turning it off takes back every permission at once. Your records stay.</li>
        </ul>
      </section>

      <section className="nf-panel nf-panel--card p-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={AI_GLYPH.protection} alt="" width={40} height={40} className="nf-ai-perm__glyph" />
        <h2 className="nf-ai-set__title">Read before you agree</h2>
        <ul className="nf-ai-links">
          <li><Link href="/ai/terms" target="_blank">AI Assistant Terms of Service</Link></li>
          <li><Link href="/ai/privacy" target="_blank">AI Privacy Policy</Link></li>
          <li><Link href="/ai/permissions" target="_blank">Permissions and Data Access</Link></li>
          <li><Link href="/ai/security" target="_blank">Security and User Protection</Link></li>
        </ul>
        <label className="nf-ai-check">
          <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} data-testid="ai-accept-terms" />
          <span>I have read and accept the AI Assistant Terms of Service.</span>
        </label>
        <label className="nf-ai-check">
          <input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} data-testid="ai-accept-privacy" />
          <span>I have read and accept the AI Privacy Policy.</span>
        </label>
        <label className="nf-ai-check nf-ai-check--agree">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} data-testid="ai-agree" />
          <span>I understand what the assistant can do, I choose to turn it on, and I can turn it off at any time.</span>
        </label>
      </section>

      {error ? (
        <p className="nf-rv-msg nf-rv-msg--error" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="primary" full disabled={!ready || pending} data-testid="ai-activate">
        {pending ? "Turning on" : "Activate assistant"}
      </Button>
    </form>
  );
}
