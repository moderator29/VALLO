import { describe, expect, it } from "vitest";
import { cleanTemplate, templatesAsReplies, TEMPLATE_TITLE_MAX } from "./reply-templates";

describe("reply templates", () => {
  it("tidies and refuses empties", () => {
    expect(cleanTemplate({ title: "  Viewing   times ", body: " Saturday at 11. " })).toEqual({ title: "Viewing times", body: "Saturday at 11." });
    expect(cleanTemplate({ title: " ", body: "x" })).toBeNull();
    expect(cleanTemplate({ title: "x", body: "  " })).toBeNull();
    expect(cleanTemplate({ title: "t".repeat(90), body: "b" })?.title.length).toBe(TEMPLATE_TITLE_MAX);
  });
  it("becomes tray chips keyed by template", () => {
    expect(templatesAsReplies([{ id: "a", title: "Hi", body: "Hello" }])).toEqual([{ key: "tpl-a", label: "Hi", text: "Hello" }]);
  });
});
