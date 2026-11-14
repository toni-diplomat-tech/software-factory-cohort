import { formatPrice } from "~/lib/utils";

/**
 * The confirmation the learner gets in their inbox after submitting a Refund
 * Request. There is no mail transport wired up yet, so the built message goes
 * to the server log.
 */
export function buildRefundRequestEmail(input: {
  learnerName: string;
  learnerEmail: string;
  courseTitle: string;
  refundableAmount: number;
}) {
  return {
    to: input.learnerEmail,
    subject: `Refund Request received — ${input.courseTitle}`,
    body: [
      `Hi ${input.learnerName},`,
      "",
      `We have your Refund Request for "${input.courseTitle}".`,
      `If your Refund Request is approved, we will refund ${formatPrice(input.refundableAmount)}, the amount you paid.`,
      "",
      "Our team reviews every Refund Request by hand. You do not need to do anything else — we will email you again when it is done.",
      "",
      "— The Cadence team",
    ].join("\n"),
  };
}
