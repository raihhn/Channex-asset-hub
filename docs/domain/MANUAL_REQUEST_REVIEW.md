# Slice 7A — Manual Request Review Foundation

Slice 7A adds a review mechanism to the existing in-memory Request prototype. It is not the final approval matrix or production authorization system.

## Model and status

Request retains the existing canonical statuses `Pending approval`, `Approved`, `Rejected`, and `Needs update`; no duplicate “Pending Review” status is introduced. New submissions capture `submittedByUserId`, enter `Pending approval`, start review cycle 1, and explicitly wait for manual assignment. Legacy fixtures without canonical requester identity remain readable; self-review checks apply when that ID is known.

`ApprovalAssignment` is a separate record containing Request ID, cycle, generic sequence, canonical reviewer User ID, status, assignment actor/time, and optional decision actor/time/note. One pending assignment is active per Request. Reassignment supersedes—but retains—the former assignment. Decided records are never edited back into pending. The model can hold later sequential steps; Slice 7A creates only one manual step per cycle and no parallel/quorum decisions.

`Request.reviewHistory` records Submitted, Assigned/Reassigned, Approved/Rejected/Needs update, and Resubmitted events with actor snapshot, timestamp, cycle, assignment reference, and note. It is domain history, separate from the cross-domain Audit Trail. New Requests have `reviewRound`; legacy fixture Requests default to cycle 1.

## Prototype actions

The prototype Super Admin manually assigns/reassigns an active internal Person from canonical People. Vendor users and inactive People are excluded. When a new Request has `submittedByUserId`, that same Person cannot be assigned as reviewer. A currently assigned reviewer who becomes inactive remains visible historically and needs manual reassignment. Only the assigned currentUser may decide; there is no Super Admin decision override. These are limited prototype guards, not final RBAC or role/scope routing.

Approve has an optional note and makes the Request `Approved` when the sole current step is approved. Reject and Needs update require reasons. Reject preserves Request and review history but removes reservation blocking via the existing centralized mapping. Needs update preserves its reservation hold under the existing mapping and opens the same Request for revision. Revision uses the four-step Request flow with fields, Asset selections, fulfillment, documents, and WBS prefilled. Resubmission retains Request ID and history, increments the cycle, returns to `Pending approval`, and requires a **new manual assignment**, even when the previous reviewer is still active. Approval does not change Asset location, custodian, outbound/inbound, return receipt, or maintenance state.

Assignment, reassignment, all decisions, submission, and resubmission create AuditEvents at the provider mutation boundary with the current Person as actor. Reviewer and assigner are different identities unless the same Person legitimately fills both roles.

## Surfaces and boundaries

Request Detail owns the review section, decision controls, status, and timeline. `/requests/approvals` and Operations link into those records; they do not bypass central transitions. The queue uses current Request ordering. Mobile uses the same responsive screens.

Reservation activation remains the existing temporary prototype rule: `Pending approval` blocks availability. `Needs update` also blocks; `Rejected` and `Cancelled` do not. Production activation point remains unresolved. WBS stays optional and manual. The >30-day Booth rule stays blocked and is not routed to this review engine.

Not implemented: L1/L2/L3, StoreDev auto-routing, Brand bypass/mandatory Brand review, Excom/value thresholds, Custom Booth routing, extension approval, financial/WBS approval, SLAs, reminders, notifications, parallel approvals, production auth/RBAC, or backend persistence. Reviewer eligibility and production self-review policy require later business decisions.
