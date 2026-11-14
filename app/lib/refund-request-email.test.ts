import { describe, expect, it } from "vitest";
import { buildRefundRequestEmail } from "./refund-request-email";

const input = {
  learnerName: "Ada",
  learnerEmail: "ada@example.com",
  courseTitle: "Intro to TypeScript",
  refundableAmount: 4900,
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

  it("says the Refund of the amount paid only follows an approved Refund Request", () => {
    const { body } = buildRefundRequestEmail(input);
    expect(body).toContain(
      'We have your Refund Request for "Intro to TypeScript".'
    );
    expect(body).toContain(
      "If your Refund Request is approved, we will refund $49.00, the amount you paid."
    );
    expect(body).not.toMatch(/The Refund is for/);
  });

  it("never uses avoided terms", () => {
    const { subject, body } = buildRefundRequestEmail(input);
    for (const text of [subject, body]) {
      expect(text).not.toMatch(/reversal|chargeback|pending/i);
    }
  });
});
