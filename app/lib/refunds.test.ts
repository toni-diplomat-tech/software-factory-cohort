import { describe, it, expect } from "vitest";
import { getRefundableAmount } from "./refunds";

// The course's list price is 10000 in each case below; the Purchase records
// what the learner actually paid.
describe("getRefundableAmount", () => {
  it("is what the learner paid for a purchasing-power-discounted Purchase", () => {
    expect(getRefundableAmount({ amountPaid: 4000 })).toBe(4000);
  });

  it("is what the learner paid for a full-price Purchase", () => {
    expect(getRefundableAmount({ amountPaid: 10000 })).toBe(10000);
  });

  it("is what the learner paid, not the course's current list price, when the price has changed since", () => {
    // Bought at 8000; the course has since been repriced to 10000.
    expect(getRefundableAmount({ amountPaid: 8000 })).toBe(8000);
  });
});
