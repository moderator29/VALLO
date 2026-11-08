"use client";

import { useState } from "react";
import { useClientCopy } from "@/lib/i18n/client-copy";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { banner } from "@/lib/ui/toast";

/**
 * The consented departure.
 *
 * Nobody leaves Vallo. Where somebody genuinely must, they are told where
 * they are going before they go, by name, and the quiet action is the one
 * that travels.
 *
 * THE ONE PLACE THIS IS FOR TODAY is a user's own profile link. "One place
 * people can find you" is the entire feature, so making it not leave would
 * make it nothing, which is why the sweep lists it as unavoidable. What was
 * avoidable is the SURPRISE: until now that chip was a single tap out of a
 * property marketplace into an arbitrary origin, supplied by the account
 * holder, checked by nobody. On a platform where people are already being
 * asked for a NIN, a one tap unannounced jump to a stranger's domain is a
 * phishing route with a verified badge above it.
 *
 * So: the host in full, in its own line, at reading size. A plain sentence
 * saying Vallo has not checked it. Copy as the primary action, because
 * copying is what somebody wants nine times in ten and it costs nothing.
 * Open as the quiet one.
 *
 * WHAT HAPPENS ON THE SHELL. `Open it anyway` is a real anchor with a real
 * foreign href, so `lib/native/external-links.ts` intercepts it exactly as it
 * intercepts any other outbound anchor and hands it to the in-app tab rather
 * than letting the web view navigate away. Nothing here needs to know that.
 */

/** Copy without the clipboard permission, for browsers that refuse it. */
function copyByExecCommand(text: string): boolean {
  try {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.top = "-1000px";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    const done = document.execCommand("copy");
    document.body.removeChild(field);
    return done;
  } catch {
    return false;
  }
}

/**
 * The host, as a person reads it, or the whole string if it will not parse.
 *
 * `www.` is dropped because it is noise in a warning, and nothing else is:
 * a subdomain is exactly the part a lookalike domain hides in.
 */
function hostOf(href: string): string {
  try {
    const host = new URL(href).host;
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return href;
  }
}

export function ExternalLinkSheet({
  href,
  label,
  className,
  children,
}: {
  href: string;
  /** The control's accessible name. The visible text is `children`. */
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  const t = useClientCopy();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const host = hostOf(href);

  async function copy() {
    let done = false;
    try {
      await navigator.clipboard.writeText(href);
      done = true;
    } catch {
      done = copyByExecCommand(href);
    }
    setCopied(done);
    /* The button keeps its tick; the banner says it (founder, 7 November 2026). */
    if (done) banner("Link copied", { tone: "success" });
  }

  return (
    <>
      <button
        type="button"
        aria-label={label}
        onClick={() => {
          setCopied(false);
          setOpen(true);
        }}
        className={className}
      >
        {children}
      </button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={t.offPlatform.title}
        closeLabel={t.offPlatform.close}
        detents={[0.5]}
      >
        <div className="flex flex-col gap-sm">
          <p className="nf-body text-[var(--nf-content-secondary)]">
            {t.offPlatform.body.replace("{host}", host)}
          </p>
          {/* The destination on its own line, unshortened and selectable.
              A warning that hides the thing it is warning about is theatre. */}
          <p className="nf-body break-all font-semibold text-[var(--nf-content-primary)]">
            {host}
          </p>
          <Button variant="primary" size="lg" full onClick={copy}>
            {copied ? t.offPlatform.copied : t.offPlatform.copy}
          </Button>
          <a
            href={href}
            rel="nofollow noopener noreferrer ugc"
            target="_blank"
            onClick={() => setOpen(false)}
            className="nf-body-sm text-center font-normal text-[var(--nf-content-muted)] underline"
          >
            {t.offPlatform.open}
          </a>
        </div>
      </Sheet>
    </>
  );
}
