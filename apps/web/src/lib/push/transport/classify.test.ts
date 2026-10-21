import { describe, expect, it } from "vitest";

import { isConfigurationFailure } from "../types";
import { readApnsError } from "./apns";
import { readFcmError } from "./fcm";

/*
 * WHAT RETIRES A DEVICE, AND WHAT NEVER MAY.
 *
 * `push_tokens` emptied itself in two quiet ways: a set-up mistake (a wrong
 * FCM project, a wrong APNs key, a bad message field) read as a dead device,
 * and every device got the same answer. A dead device is retired; our own
 * mistake is recorded and never counted against the device.
 */
const fcm = (status: number, error: Record<string, unknown>) => readFcmError(status, JSON.stringify({ error }));

describe("FCM replies", () => {
  it("retires an UNREGISTERED token", () => {
    expect(fcm(404, { status: "NOT_FOUND", details: [{ errorCode: "UNREGISTERED" }] }).outcome).toBe("gone");
  });

  it("does not retire on a 404 that is a wrong project id", () => {
    const reply = fcm(404, { status: "NOT_FOUND" });
    expect(reply.outcome).toBe("failed");
    expect(isConfigurationFailure(reply)).toBe(true);
    expect(readFcmError(404, "<html>").outcome).toBe("failed");
  });

  it("retires a malformed token, and only that kind of INVALID_ARGUMENT", () => {
    expect(
      fcm(400, {
        status: "INVALID_ARGUMENT",
        details: [{ errorCode: "INVALID_ARGUMENT" }, { fieldViolations: [{ field: "message.token" }] }],
      }).outcome,
    ).toBe("gone");
    expect(
      fcm(400, {
        status: "INVALID_ARGUMENT",
        details: [{ errorCode: "INVALID_ARGUMENT" }, { fieldViolations: [{ field: "message.data" }] }],
      }).outcome,
    ).toBe("failed");
  });

  it("treats credentials refused as ours, a sender mismatch as the device's", () => {
    expect(isConfigurationFailure(fcm(403, { status: "PERMISSION_DENIED" }))).toBe(true);
    expect(isConfigurationFailure(fcm(401, { status: "UNAUTHENTICATED" }))).toBe(true);
    expect(isConfigurationFailure(fcm(403, { status: "PERMISSION_DENIED", details: [{ errorCode: "SENDER_ID_MISMATCH" }] }))).toBe(false);
  });
});

describe("APNs replies", () => {
  it("retires Unregistered and 410", () => {
    expect(readApnsError(410, JSON.stringify({ reason: "Unregistered" })).outcome).toBe("gone");
  });

  it("does not read Apple's 404 BadPath as a dead device", () => {
    const reply = readApnsError(404, JSON.stringify({ reason: "BadPath" }));
    expect(reply.outcome).toBe("failed");
    expect(isConfigurationFailure(reply)).toBe(true);
  });

  it("treats a bad provider token or topic as ours", () => {
    for (const reason of ["InvalidProviderToken", "ExpiredProviderToken", "BadTopic", "TopicDisallowed"]) {
      expect(isConfigurationFailure(readApnsError(403, JSON.stringify({ reason }))), reason).toBe(true);
    }
    expect(isConfigurationFailure(readApnsError(400, JSON.stringify({ reason: "BadDeviceToken" })))).toBe(false);
  });
});
