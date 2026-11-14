/**
 * The Refundable Amount for a Purchase: what a Refund would give back. It is
 * always exactly what the learner paid — never the course's list price, which
 * may have changed since, or been discounted for purchasing power.
 */
export function getRefundableAmount(purchase: { amountPaid: number }): number {
  return purchase.amountPaid;
}
