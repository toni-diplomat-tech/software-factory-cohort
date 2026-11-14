# Cadence

An online course platform where learners buy courses, watch lessons, and can ask for their money back.

## Language

### Refunds

**Refund Request**:
A learner's ask, with a reason, to get their money back for a Purchase; it is Requested, then Approved or Declined. A Purchase can have many Refund Requests, but only one open at a time.
_Avoid_: Chargeback, Reversal, Cancellation, Pending Refund

**Requested**:
The state of a Refund Request that is waiting on the team to decide.
_Avoid_: Pending, Open, Raised

**Refund**:
Money given back to a learner for a Purchase, always exactly the Refundable Amount, which exists only once a Refund Request is Approved. A Purchase has at most one Refund.
_Avoid_: Chargeback, Reversal, Partial refund

**Refundable Amount**:
The amount a Refund would return, which is always exactly what the learner paid for the Purchase.
_Avoid_: Refund amount, list price
