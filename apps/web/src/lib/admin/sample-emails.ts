"use server";

import { z } from "zod";
import { fail, ok, validate, type ActionResult } from "../actions/envelope";
import { adminRefusal, requireAdmin } from "./guard";
import { sendEmail } from "../email/client";
import { EVERY_MESSAGE } from "../email/fixtures";
import { platformNewsletter } from "../email/newsletter-message";
import { bannerFor } from "../email/banners";
import type { EmailKind } from "../email/icons";

/**
 * THE SAMPLE SET (4 November 2026, the founder: "send me every email so I can
 * look at them").
 *
 * Every kind of email the platform sends, built from the same sample data the
 * test catalogue uses (a made-up person, a made-up listing, a sample code), and
 * the newsletter, sent to one or two addresses the founder names. Founder only.
 * Nothing here reaches a member, and no member's data is read: the samples are
 * fixtures. Every subject is marked "[Sample n/total]" so a sample can never be
 * mistaken for a real message.
 *
 * It sends a few at a time and answers where it got to, so the screen can ask
 * again until the set is done and no request runs long.
 */
const BATCH = 5;

const schema = z.object({
  to: z.array(z.string().trim().email()).min(1).max(2),
  offset: z.number().int().min(0).max(500),
});

type SampleItem = { name: string; subject: string; html: string; text: string };

/** At most this many samples per banner, so each design is seen without a flood of near-copies. */
const PER_BANNER = 3;

function samples(): SampleItem[] {
  const taken = new Map<string, number>();
  const seen = new Set<string>();
  const all: SampleItem[] = [];
  for (const { name, message } of EVERY_MESSAGE) {
    const base = name.split(":")[0]!;
    if (seen.has(base)) continue;
    const family = base.startsWith("welcome") ? "welcome" : bannerFor(base as EmailKind);
    const count = taken.get(family) ?? 0;
    const cap = family === "welcome" ? 1 : family === "email-banner-1" ? 6 : family === "email-banner-2" ? 5 : PER_BANNER;
    if (count >= cap) continue;
    seen.add(base);
    taken.set(family, count + 1);
    all.push({ name, subject: message.subject, html: message.html, text: message.text });
  }
  const letter = platformNewsletter({ name: "Ada" });
  all.push({ name: "newsletter", subject: letter.subject, html: letter.html, text: letter.text });
  return all;
}

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function sendSampleBatch(input: {
  to: string[];
  offset: number;
}): Promise<ActionResult<{ total: number; nextOffset: number; sent: number; failed: number; done: boolean }>> {
  const access = await requireAdmin();
  if (access.state !== "admin") return fail(adminRefusal(access));
  if (!access.isFounder) return fail("Only the founder can send the sample set.");

  const parsed = validate(schema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const all = samples();
  const slice = all.slice(parsed.data.offset, parsed.data.offset + BATCH);
  let sent = 0;
  let failed = 0;
  for (const [i, item] of slice.entries()) {
    const n = parsed.data.offset + i + 1;
    for (const to of parsed.data.to) {
      const result = await sendEmail({
        to,
        subject: `[Sample ${n}/${all.length}] ${item.subject}`,
        html: item.html,
        text: item.text,
      });
      if (result.sent) sent += 1;
      else failed += 1;
      /* The mail service allows a couple of requests a second. */
      await pause(600);
    }
  }
  const nextOffset = parsed.data.offset + slice.length;
  return ok({ total: all.length, nextOffset, sent, failed, done: nextOffset >= all.length });
}
