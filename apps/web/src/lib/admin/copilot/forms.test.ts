import { describe, expect, it } from "vitest";
import { answersToMessage, copilotFormSchema, initialAnswers, missingAnswer } from "./forms";

const card = {
  title: "Which tickets",
  submit: "Show me the tickets",
  fields: [
    { id: "lane", label: "Which lane?", kind: "single" as const, options: ["Money", "Safety", "Everything"], initial: "Everything" },
    { id: "age", label: "Older than", kind: "single" as const, options: ["A day", "Three days", "A week"] },
    { id: "tone", label: "How should replies sound?", kind: "scale" as const, lowLabel: "Brief", highLabel: "Warm" },
    { id: "resolve", label: "Resolve after replying?", kind: "yesno" as const, required: false },
  ],
};

describe("the copilot's question cards", () => {
  it("accepts a well-formed card and refuses a broken one", () => {
    expect(copilotFormSchema.safeParse(card).success).toBe(true);
    expect(copilotFormSchema.safeParse({ ...card, fields: [] }).success).toBe(false);
    expect(copilotFormSchema.safeParse({ ...card, fields: [{ id: "x", label: "Pick", kind: "single", options: ["Only one"] }] }).success).toBe(false);
    expect(copilotFormSchema.safeParse({ ...card, fields: [card.fields[0], card.fields[0]] }).success).toBe(false);
    expect(copilotFormSchema.safeParse({ ...card, fields: Array.from({ length: 6 }, (_, i) => ({ id: `q${i}`, label: "Q", kind: "text" })) }).success).toBe(false);
    expect(copilotFormSchema.safeParse({ ...card, fields: [{ id: "Bad Id", label: "Q", kind: "text" }] }).success).toBe(false);
  });

  it("starts from the card's own suggestions, only where they are real choices", () => {
    expect(initialAnswers(card)).toEqual({ lane: "Everything", age: null, tone: null, resolve: null });
    expect(initialAnswers({ fields: [{ id: "a", label: "A", kind: "single", options: ["x", "y"], initial: "z" }] })).toEqual({ a: null });
  });

  it("holds the button until every required question has an answer; optional ones may stay empty", () => {
    const start = initialAnswers(card);
    expect(missingAnswer(card, start)?.id).toBe("age");
    expect(missingAnswer(card, { ...start, age: "A week", tone: 4 })).toBeNull();
    expect(missingAnswer({ fields: [{ id: "n", label: "N", kind: "number", min: 1, max: 10 }] }, { n: 40 })?.id).toBe("n");
  });

  it("sends the answers as plain words under the card's title", () => {
    expect(answersToMessage(card, { lane: "Money", age: "A week", tone: 4, resolve: "yes" })).toBe(
      "Which tickets:\n- Which lane: Money\n- Older than: A week\n- How should replies sound: 4 out of 5\n- Resolve after replying: Yes",
    );
  });
});
