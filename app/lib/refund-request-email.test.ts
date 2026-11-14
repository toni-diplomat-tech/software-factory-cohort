import { describe, expect, it } from "vitest";
import { buildRefundRequestEmail } from "./refund-request-email";

const input = {
  learnerName: "Ada",
  learnerEmail: "ada@example.com",
  courseTitle: "Intro to TypeScript",
  amount: 4900,
};

describe("buildRefundRequestEmail", () => {
  it("is addressed to the learner", () => {
    expect(buildRefundRequestEmail(input).to).toBe("ada@example.com");
  });

  it("has a subject saying the Refund Request was received for the course", () => {
    expect(buildRefundRequestEmail(input).subject).toBe(
      "Refund Request received — Intro to TypeScript"
    );
  });

  it("talks about the Refund Request and the Refund, with the amount", () => {
    const { body } = buildRefundRequestEmail(input);
    expect(body).toContain(
      'We have your Refund Request for "Intro to TypeScript".'
    );
    expect(body).toContain("The Refund is for $49.00, the amount you paid.");
  });

  it("never uses avoided terms", () => {
    const { subject, body } = buildRefundRequestEmail(input);
    for (const text of [subject, body]) {
      expect(text).not.toMatch(/reversal|chargeback|pending/i);
    }
  });
});
