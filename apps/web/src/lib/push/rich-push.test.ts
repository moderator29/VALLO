import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/listings/supabase-repository", () => ({ photoUrl: (p: string) => (p.startsWith("/") ? p : `https://store.example/listing-photos/${p}`) }));
vi.mock("@/lib/stays/photos", () => ({ accommodationPhotoUrl: (p: string) => `https://store.example/accommodation-photos/${p}` }));
vi.mock("@/lib/site", () => ({ siteUrl: () => "https://www.vallospaces.com" }));

import { ANDROID_CHANNELS, androidChannelFor, familyOf } from "./family";
import { absoluteImage, imageTargetOf, resolvePushImages } from "./imagery";
import { decide, type QueuedNotification } from "./policy";
import type { PushClient } from "./schema";

const THREAD = "11111111-2222-4333-8444-555555555555";
const LISTING = "ed000000-0000-4000-8000-00000000003e";

describe("A1 to A3: the family of a push", () => {
  it("names the header line, the Android channel and the iOS category per kind", () => {
    expect(familyOf({ kind: "message" })).toMatchObject({ family: "messages", label: "Messages", androidChannel: "vallo_messages", iosCategory: "VALLO_MESSAGES" });
    expect(familyOf({ kind: "support" }).family).toBe("messages");
    expect(familyOf({ kind: "booking" }).family).toBe("bookings");
    expect(familyOf({ kind: "wallet" }).family).toBe("money");
    expect(familyOf({ kind: "social" }).family).toBe("activity");
    expect(familyOf({ kind: "listing", priceDrop: true }).family).toBe("offers");
    expect(familyOf({ kind: "message", call: true }).family).toBe("calls");
  });

  it("keeps the call channels every phone already has, and the summary on the default", () => {
    expect(androidChannelFor({ call: true, tag: "x", category: "calls" })).toBe("vallo_calls");
    expect(androidChannelFor({ quiet: true, tag: "vallo-missed-call", category: "calls" })).toBe("vallo_missed");
    expect(androidChannelFor({ tag: "vallo-summary" })).toBe("vallo_default");
    expect(androidChannelFor({ tag: "vallo-message", category: "messages" })).toBe("vallo_messages");
    /* Every channel a push can name is one the shell creates. */
    const created = new Set(ANDROID_CHANNELS.map((c) => c.id));
    for (const f of ["messages", "bookings", "money", "activity", "offers"] as const) {
      expect(created.has(androidChannelFor({ tag: "t", category: f }))).toBe(true);
    }
  });

  it("decide() carries the family on every push it sends", () => {
    const now = new Date("2026-11-07T12:00:00Z");
    const notification: QueuedNotification = {
      queueId: "q",
      userId: "u",
      kind: "message",
      title: "Amara replied",
      body: "About the flat",
      href: `/messages/${THREAD}`,
      createdAt: now,
      expiresAt: new Date(now.getTime() + 3_600_000),
    };
    const verdict = decide({ notification, settings: {}, now });
    expect(verdict.action).toBe("send");
    if (verdict.action === "send") expect(verdict.payload).toMatchObject({ category: "messages", subtitle: "Messages" });
  });
});

describe("A1 to A3: the picture", () => {
  it("knows which destinations are a picture of something", () => {
    expect(imageTargetOf(`/listing/${LISTING}`)).toEqual({ kind: "listing", id: LISTING });
    expect(imageTargetOf(`/stay/${LISTING}?from=push`)).toEqual({ kind: "stay", id: LISTING });
    expect(imageTargetOf(`/messages/${THREAD}`)).toEqual({ kind: "thread", id: THREAD });
    expect(imageTargetOf("/wallet")).toBeNull();
    expect(imageTargetOf(null)).toBeNull();
  });

  it("only ever sends an https address a phone can fetch with no session", () => {
    const site = "https://www.vallospaces.com";
    expect(absoluteImage("/brand/photos/a.jpg", site)).toBe("https://www.vallospaces.com/brand/photos/a.jpg");
    expect(absoluteImage("https://x.example/a.jpg", site)).toBe("https://x.example/a.jpg");
    expect(absoluteImage("http://x.example/a.jpg", site)).toBeNull();
    expect(absoluteImage("//evil.example/a.jpg", site)).toBeNull();
    expect(absoluteImage("javascript:alert(1)", site)).toBeNull();
    expect(absoluteImage(null, site)).toBeNull();
  });

  it("a listing gets its cover; a thread gets the OTHER person's face, or the place it is about", async () => {
    const tables: Record<string, unknown[]> = {
      conversations: [{ id: THREAD, guest_id: "me", agent_id: "them", listing_id: LISTING }],
      listing_photos: [
        { listing_id: LISTING, storage_path: "b.jpg", position: 1 },
        { listing_id: LISTING, storage_path: "a.jpg", position: 0 },
      ],
      accommodation_photos: [],
      profiles: [{ id: "them", avatar_url: null }],
    };
    const builder = (rows: unknown[]) => {
      const q = { in: () => q, lte: () => q, then: (r: (v: { data: unknown[] }) => unknown) => Promise.resolve({ data: rows }).then(r) };
      return { select: () => q };
    };
    const admin = { from: (t: string) => builder(tables[t] ?? []) } as unknown as PushClient;
    const images = await resolvePushImages(admin, "me", [`/listing/${LISTING}`, `/messages/${THREAD}`, "/wallet"]);
    expect(images.get(`/listing/${LISTING}`)).toBe("https://store.example/listing-photos/a.jpg");
    /* No face on file: the place the conversation is about. */
    expect(images.get(`/messages/${THREAD}`)).toBe("https://store.example/listing-photos/a.jpg");
    expect(images.has("/wallet")).toBe(false);

    tables.profiles = [{ id: "them", avatar_url: "https://faces.example/them.jpg" }];
    const withFace = await resolvePushImages(admin, "me", [`/messages/${THREAD}`]);
    expect(withFace.get(`/messages/${THREAD}`)).toBe("https://faces.example/them.jpg");
  });

  it("a failed read is a push without a picture, never an error", async () => {
    const admin = { from: () => { throw new Error("down"); } } as unknown as PushClient;
    expect((await resolvePushImages(admin, "me", [`/listing/${LISTING}`])).size).toBe(0);
  });
});

describe("A1: the iOS Notification Service Extension source", () => {
  it("downloads only an https image into an attachment and always shows the push", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const root = fileURLToPath(new URL("../../../", import.meta.url));
    const swift = readFileSync(`${root}ios/App/VALLONotificationService/NotificationService.swift`, "utf8");
    const plist = readFileSync(`${root}ios/App/VALLONotificationService/Info.plist`, "utf8");
    expect(swift).toContain('request.content.userInfo["image"]');
    expect(swift).toContain('url.scheme == "https"');
    expect(swift).toContain("UNNotificationAttachment(identifier:");
    expect(swift).toContain("override func serviceExtensionTimeWillExpire()");
    expect(plist).toContain("com.apple.usernotifications.service");
    /* The server marks every push mutable, which is what wakes the extension. */
    expect(readFileSync(`${root}src/lib/push/transport/apns.ts`, "utf8")).toContain('"mutable-content": 1');
  });
});
